import { google } from "googleapis";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

type Row = { recorded_at: string; suhu: number; kelembaban: number };

const SHEET_ID = () => process.env.GOOGLE_SHEET_ID!;
const SHEET_TAB = () => process.env.GOOGLE_SHEET_TAB || "Data";

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

// Duplikat tab kerja jadi tab arsip baru DI DALAM spreadsheet yang sama
// (bukan bikin file baru di Drive). Service account nggak punya kuota
// storage Drive sendiri, jadi bikin FILE baru selalu gagal "storage
// quota exceeded" -- tapi nambah/ubah isi file yang udah ada sama
// sekali nggak kena kuota itu.
export async function archiveToNewTab(dateLabel: string) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID() });
  const workingSheet = meta.data.sheets?.find(
    (s) => s.properties?.title === SHEET_TAB()
  );
  const sheetId = workingSheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) {
    throw new Error(`Tab kerja "${SHEET_TAB()}" tidak ditemukan di spreadsheet`);
  }

  const newTitle = `Arsip-${dateLabel}`;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID(),
    requestBody: {
      requests: [
        {
          duplicateSheet: {
            sourceSheetId: sheetId,
            newSheetName: newTitle,
          },
        },
      ],
    },
  });

  return newTitle;
}

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
