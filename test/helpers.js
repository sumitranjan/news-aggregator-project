const { randomBytes } = require("node:crypto");

function memoryUsers() {
  const rows = new Map();
  return {
    rows,
    async create(data) {
      if ([...rows.values()].some((row) => row.email === data.email))
        throw Object.assign(new Error("Duplicate"), { code: 11000 });
      const row = { ...data, _id: randomBytes(12).toString("hex") };
      rows.set(row._id, row);
      return row;
    },
    async findByEmail(email) {
      return [...rows.values()].find((row) => row.email === email);
    },
    async findById(id) {
      return rows.get(String(id));
    },
    async updatePreferences(id, value) {
      const row = rows.get(String(id));
      if (!row) return null;
      Object.assign(row, value);
      return row;
    },
  };
}
module.exports = { memoryUsers };
