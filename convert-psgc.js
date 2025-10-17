// convert-psgc.js
const fs = require("fs");
const xlsx = require("xlsx");

// Load file
const filePath = "PSGC-2Q-2025-Publication-Datafile.xlsx";
const workbook = xlsx.readFile(filePath);
const sheet = workbook.Sheets["PSGC"];
const rows = xlsx.utils.sheet_to_json(sheet);

// Prepare hierarchy
let hierarchy = {};
let currentProvince = null;
let currentCity = null;

for (const row of rows) {
  const level = row["Geographic Level"];
  const name = row["Name"];

  if (level === "Prov") {
    currentProvince = name;
    hierarchy[currentProvince] = {};
  }

  if (level === "City" || level === "Mun") {
    currentCity = name;
    if (currentProvince) {
      hierarchy[currentProvince][currentCity] = [];
    }
  }

  if (level === "Bgy") {
    if (currentProvince && currentCity) {
      hierarchy[currentProvince][currentCity].push(name);
    }
  }
}

// Save JSON
fs.writeFileSync("ph-address.json", JSON.stringify(hierarchy, null, 2), "utf-8");

