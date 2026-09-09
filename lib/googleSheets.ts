import { google } from "googleapis";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

type Row = { recorded_at: string; suhu: number; kelembaban: number };

const SHEET_ID = () => process.env.GOOGLE_SHEET_ID!;
const SHEET_TAB = () => process.env.GOOGLE_SHEET_TAB || "Data";
const ARCHIVE_FOLDER = () => process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID!;

// Tulis header + baris data (waktu, suhu, kelembaban) ke sheet kerja.
export async function writeRowsToSheet(rows: Row[]) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const tab = SHEET_TAB();

  const values = [
    ["Waktu", "Suhu (°C)", "Kelembaban (%)"],
    ...rows.map((r) => [
      new Date(r.recorded_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
      r.suhu,
      r.kelembaban,
    ]),
  ];

  // Bersihkan sheet dulu, baru tulis ulang dari baris pertama
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID(),
    range: `${tab}!A:C`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

// Salin file spreadsheet ke folder arsip di Drive dengan nama bertanggal.
// Google Sheets otomatis tersimpan di Drive; "menyimpan ke drive" di sini
// diwujudkan sebagai snapshot harian yang diarsipkan (biar histori tiap
// hari tidak ketimpa waktu sheet kerja direset).
export async function archiveSheetToDrive(dateLabel: string) {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  const copy = await drive.files.copy({
    fileId: SHEET_ID(),
    requestBody: {
      name: `Suhu-Kelembaban-${dateLabel}`,
      parents: [ARCHIVE_FOLDER()],
    },
  });

  return copy.data.id as string;
}

// Kosongkan lagi sheet kerja (cuma header) setelah diarsipkan.
export async function clearWorkingSheet() {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const tab = SHEET_TAB();

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID(),
    range: `${tab}!A:C`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [["Waktu", "Suhu (°C)", "Kelembaban (%)"]] },
  });
}
