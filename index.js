require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 1715;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname, {
  index: false,          // jangan auto-serve index.html untuk /
  extensions: false,     // jangan auto-resolve .html
}));


// ================= DATABASE =================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// ================= SCHEMA =================
const userSchema = new mongoose.Schema({
  email: String,
  username: String,
  password: String,
  role: {
    type: String,
    default: "user",
  },
  key: String,
  key_type: String,
  key_expires_at: Date,
  max_devices: {
    type: Number,
    default: 1,
  },
  allowed_devices: {
    type: Array,
    default: [],
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

const configSchema = new mongoose.Schema({
  password: String,
  blacklistedUsers: {
    type: Object,
    default: {},
  },
  activeSessions: {
    type: Object,
    default: {},
  },
  userKeys: {
    type: Object,
    default: {},
  },
  devices: {
    type: Array,
    default: [],
  },
});

const sessionSchema = new mongoose.Schema({
  username: String,
  token: String,
  deviceId: String,
  created_at: {
    type: Date,
    default: Date.now,
  },
});

const Session = mongoose.model("Session", sessionSchema);
const logSchema = new mongoose.Schema({
  text: String,
  detail: String,
  color: String,
  time: String,
});

const broadcastSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: "info" }, // info | warning | danger | success
  active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const appVersionSchema = new mongoose.Schema({
  current_version: { type: String, default: "0.0.0" },
  latest_version: { type: String, default: "0.0.0" },
  download_url: { type: String, default: "" },
  notes: { type: String, default: "" },
  force_update: { type: Boolean, default: true },
  updated_at: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Config = mongoose.model("Config", configSchema);
const Log = mongoose.model("Log", logSchema);
const Broadcast = mongoose.model("Broadcast", broadcastSchema);
const AppVersion = mongoose.model("AppVersion", appVersionSchema);

// ================= HARDCODED ADMIN =================
const HARDCODED_ADMIN = {
  username: "DavinaTM",
  password: "DavinaExe23xx2",
  role: "super_admin",
};

// ================= HELPERS =================
function generateKey() {
  const prefix = "STV";
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let body = "";
  for (let i = 0; i < 12; i++) {
    body += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${body}`;
}

function generateSessionToken() {
  return (
    Math.random()
      .toString(36)
      .slice(2) +
    Date.now() +
    Math.random()
      .toString(36)
      .slice(2)
  );
}

async function getConfig() {
  let config = await Config.findOne();

  if (!config) {
    config = await Config.create({});
  }

  return config;
}

async function pushActivityLog(text, detail, color) {
  await Log.create({
    text,
    detail,
    color,
    time: new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  });
}

// ================= GET USERS =================
app.get("/api/get-users", async (req, res) => {
  try {
    const users = await User.find().select("-password");

    const config = await getConfig();

    const result = users.map((u) => ({
      ...u.toObject(),
      isBlacklisted: !!config.blacklistedUsers[u.username],
      deviceCount: u.allowed_devices.length,
    }));

    res.json(result);
  } catch {
    res.status(500).json([]);
  }
});

// ================= ADMIN LOGIN =================
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (
    username === HARDCODED_ADMIN.username &&
    password === HARDCODED_ADMIN.password
  ) {
    return res.json({
      success: true,
      user: HARDCODED_ADMIN,
    });
  }

  const user = await User.findOne({ username, password });

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Username atau password salah.",
    });
  }

  const safeUser = user.toObject();
  delete safeUser.password;

  res.json({
    success: true,
    user: safeUser,
  });
});


// ================= USER LOGIN =================
app.post("/api/user-login", async (req, res) => {
  try {

    const {
      username,
      password,
      deviceId,
    } = req.body;

    const user =
      await User.findOne({
        username,
        password,
      });

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "Username atau password salah.",
      });
    }

    const config =
      await getConfig();

    if (
      config.blacklistedUsers[
        username
      ]
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Akun diblacklist.",
      });
    }

    // ================= DEVICE CHECK =================
    if (
      !user.allowed_devices.includes(
        deviceId
      )
    ) {

      if (
        user.allowed_devices.length >=
        user.max_devices
      ) {

        return res.status(403).json({
          success: false,
          message:
            "Batas perangkat tercapai.",
        });

      }

      user.allowed_devices.push(
        deviceId
      );

      await user.save();
    }

    // ================= CREATE SESSION =================
    const token =
      generateSessionToken();

    await Session.deleteMany({
      username,
      deviceId,
    });

    await Session.create({
      username,
      token,
      deviceId,
    });

    res.json({
      success: true,

      token,

      username:
        user.username,

      email: user.email,

      role: user.role,

      key: user.key,

      key_type:
        user.key_type,

      key_expires_at:
        user.key_expires_at,

      created_at:
        user.created_at,
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      success: false,
      message:
        "Server error.",
    });

  }
});

// ================= KEY LOGIN =================
app.post("/api/key-login", async (req, res) => {
  try {

    const {
      key,
      deviceId,
    } = req.body;

    // VALIDASI
    if (!key || !deviceId) {
      return res.status(400).json({
        success: false,
        message: "Key atau device ID kosong.",
      });
    }

    // CARI USER BERDASARKAN KEY
    const user = await User.findOne({
      key: key.toUpperCase(),
    });

    // USER TIDAK ADA
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Key tidak valid.",
      });
    }

    // BLACKLIST CHECK
    const config = await getConfig();

    if (
      config.blacklistedUsers[
        user.username
      ]
    ) {
      return res.status(403).json({
        success: false,
        message: "Akun diblacklist.",
      });
    }

    // KEY EXPIRED
    if (
      user.key_type !== "permanent" &&
      user.key_expires_at &&
      new Date() >
        new Date(user.key_expires_at)
    ) {

      return res.status(403).json({
        success: false,
        message: "Key sudah expired.",
      });

    }

    // DEVICE CHECK
    if (
      !user.allowed_devices.includes(
        deviceId
      )
    ) {

      // DEVICE LIMIT
      if (
        user.allowed_devices.length >=
        user.max_devices
      ) {

        return res.status(403).json({
          success: false,
          message:
            "Batas perangkat tercapai.",
        });

      }

      // TAMBAH DEVICE
      user.allowed_devices.push(
        deviceId
      );

      await user.save();
    }

    // HAPUS SESSION LAMA DEVICE INI
    await Session.deleteMany({
      username: user.username,
      deviceId,
    });

    // BUAT SESSION BARU
    const token =
      generateSessionToken();

    await Session.create({
      username: user.username,
      token,
      deviceId,
    });

    // RESPONSE
    return res.json({
      success: true,

      token,

      user: {
        username:
          user.username,

        email:
          user.email,

        role:
          user.role,

        created_at:
          user.created_at,

        key_type:
          user.key_type,

        key_expires_at:
          user.key_expires_at,
      },
    });

  } catch (err) {

    console.log(err);

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });

  }
});

// ================= CHECK SESSION =================
app.post(
  "/api/check-session",
  async (req, res) => {

    try {

      const {
        token,
        deviceId,
      } = req.body;

      // VALIDATION
      if (
        !token ||
        !deviceId
      ) {

        return res.json({
          success: false,
          message: "Token/device kosong",
        });

      }

      // FIND SESSION
      const session =
        await Session.findOne({
          token,
        });

      if (!session) {

        return res.json({
          success: false,
          message: "Session tidak ditemukan",
        });

      }

      // DEVICE CHECK
      if (
        session.deviceId !==
        deviceId
      ) {

        return res.json({
          success: false,
          message: "Device mismatch",
        });

      }

      // FIND USER
      const user =
        await User.findOne({
          username:
            session.username,
        });

      if (!user) {

        await Session.deleteOne({
          token,
        });

        return res.json({
          success: false,
          message: "User tidak ada",
        });

      }

      // DEVICE DICABUT
      if (
        !user.allowed_devices.includes(
          deviceId
        )
      ) {

        await Session.deleteOne({
          token,
        });

        return res.json({
          success: false,
          message: "Device dicabut",
        });

      }

      // KEY KOSONG
      if (!user.key) {

        await Session.deleteOne({
          token,
        });

        return res.json({
          success: false,
          message: "Key kosong",
        });

      }

      // EXPIRED
      if (
        user.key_type !==
          "permanent" &&
        user.key_expires_at &&
        new Date() >
          new Date(
            user.key_expires_at
          )
      ) {

        await Session.deleteOne({
          token,
        });

        return res.json({
          success: false,
          message: "Key expired",
        });

      }

      // SUCCESS
      return res.json({
        success: true,
        user: {
          username:
            user.username,
          role: user.role,
        },
      });

    } catch (err) {

      console.log(err);

      return res.status(500).json({
        success: false,
        message: "Server error",
      });

    }
  }
);
// ================= LOGOUT =================
app.post(
  "/api/logout",
  async (req, res) => {

    try {

      const { token } =
        req.body;

      await Session.deleteOne({
        token,
      });

      res.json({
        success: true,
      });

    } catch {

      res.json({
        success: false,
      });

    }
  }
);

// ================= CREATE USER =================
app.post("/api/create-user", async (req, res) => {
  try {
    const {
      email,
      username,
      password,
      role,
      createKey,
      keyType,
      maxDevices,
    } = req.body;

    const checkUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (checkUser) {
      return res.status(409).json({
        success: false,
        message: "Username atau email sudah dipakai.",
      });
    }

    const user = new User({
      email,
      username,
      password,
      role,
      max_devices: parseInt(maxDevices) || 1,
    });

    if (createKey) {
      user.key = generateKey();
      user.key_type = keyType;
      
      if (keyType === "hourly") { 
        user.key_expires_at = new Date( 
          Date.now() + 1 * 60 * 60 * 1000, 
        );
      }
      
      if (keyType === "weekly") {
        user.key_expires_at = new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        );
      }

      if (keyType === "monthly") {
        user.key_expires_at = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        );
      }
    }

    await user.save();

    await pushActivityLog(
      "User Baru",
      `User '${username}' dibuat.`,
      "#22c55e",
    );

    res.json({
      success: true,
      message: "User berhasil dibuat.",
      key: user.key,
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
});

// ================= DELETE USER =================
app.delete("/api/delete-user/:username", async (req, res) => {
  try {
    await User.deleteOne({
      username: req.params.username,
    });

    await pushActivityLog(
      "Delete User",
      `${req.params.username} dihapus.`,
      "#ef4444",
    );

    res.json({
      success: true,
      message: "User berhasil dihapus.",
    });
  } catch {
    res.status(500).json({
      success: false,
    });
  }
});

// ================= UPDATE USER KEY =================
app.put("/api/update-user-key/:username", async (req, res) => {
  try {
    const { newKey, maxDevices, keyType } = req.body;

    const user = await User.findOne({
      username: req.params.username,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
      });
    }

    user.key = newKey;
    user.key_type = keyType;
    user.max_devices = parseInt(maxDevices) || 1;
    
    if (keyType === "hourly") {
      user.key_expires_at = new Date(
        Date.now() + 1 * 60 * 60 * 1000,
      );
    }
    
    if (keyType === "weekly") {
      user.key_expires_at = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      );
    }

    if (keyType === "monthly") {
      user.key_expires_at = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      );
    }

    await user.save();

    res.json({
      success: true,
      message: "Key berhasil diupdate.",
    });
  } catch {
    res.status(500).json({
      success: false,
    });
  }
});

// ================= TOGGLE BLACKLIST =================
// ================= TOGGLE BLACKLIST =================
app.put("/api/toggle-blacklist/:username", async (req, res) => {
  try {
    const config = await getConfig();
    const username = req.params.username;

    const currentStatus = !!config.blacklistedUsers[username];
    
    // MongoDB tidak detect perubahan nested object, harus pakai cara ini:
    config.blacklistedUsers = {
      ...config.blacklistedUsers,
      [username]: !currentStatus,
    };
    config.markModified("blacklistedUsers"); // <-- INI YANG PENTING
    
    await config.save();

    res.json({
      success: true,
      blacklisted: config.blacklistedUsers[username],
      message: config.blacklistedUsers[username]
        ? "User diblacklist"
        : "Blacklist dihapus",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/reset-device/:username", async (req, res) => {
  try {
    const { targetDevices, resetAll } = req.body;
    const user = await User.findOne({ username: req.params.username });

    if (!user) return res.status(404).json({ success: false });

    if (resetAll) {
      user.allowed_devices = [];
    } else {
      user.allowed_devices = user.allowed_devices.filter(
        (id) => !targetDevices.includes(id)
      );
    }

    user.markModified("allowed_devices");
    await user.save();

    await pushActivityLog(
      "Reset Device",
      `Perangkat '${req.params.username}' direset.`,
      "#42a5f5"
    );

    res.json({ success: true, message: "Perangkat berhasil direset." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false });
  }
});

// ================= USER STATUS =================
app.get("/api/user-status/:username", async (req, res) => {
  try {
    const config = await getConfig();
    const user = await User.findOne({ username: req.params.username });

    if (!user) return res.json({ success: false });

    res.json({
      success: true,
      isBlacklisted: !!config.blacklistedUsers[user.username],
      key: user.key,
      allowed_devices: user.allowed_devices,
    });
  } catch {
    res.json({ success: false });
  }
});
// ================= GET PASSWORD =================
app.get("/api/get-password", async (req, res) => {
  const config = await getConfig();

  res.json(config);
});

// ================= SAVE PASSWORD =================
app.post("/api/save-password", async (req, res) => {
  const { newPassword } = req.body;

  const config = await getConfig();

  config.password = newPassword;

  await config.save();

  res.json({
    success: true,
    message: "Password berhasil diubah.",
  });
});

// ================= GET LOGS =================
app.get("/api/get-logs", async (req, res) => {
  const logs = await Log.find().sort({ _id: -1 }).limit(100);

  res.json(logs);
});

// ================= ADD LOG =================
app.post("/api/add-log", async (req, res) => {
  await Log.create(req.body);

  res.json({
    success: true,
  });
});

app.get('/', (req, res) => res.sendFile(__dirname + '/home.html'));
app.get('/login', (req, res) => res.sendFile(__dirname + '/login.html'));
app.get('/dashboard', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/shop', (req, res) => res.sendFile(__dirname + '/shop.html'));
app.get('/download', (req, res) => res.sendFile(__dirname + '/download.html'));

// ================= GET BROADCASTS =================
app.get("/api/broadcasts", async (req, res) => {
  try {
    const broadcasts = await Broadcast.find().sort({ created_at: -1 });
    res.json({ success: true, broadcasts });
  } catch {
    res.status(500).json({ success: false, broadcasts: [] });
  }
});

// ================= GET ACTIVE BROADCASTS (public - for login page) =================
app.get("/api/broadcasts/active", async (req, res) => {
  try {
    const broadcasts = await Broadcast.find({ active: true }).sort({ created_at: -1 });
    res.json({ success: true, broadcasts });
  } catch {
    res.status(500).json({ success: false, broadcasts: [] });
  }
});

// ================= CREATE BROADCAST =================
app.post("/api/broadcasts", async (req, res) => {
  try {
    const { title, message, type, active } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: "Judul dan pesan wajib diisi." });
    }
    const broadcast = await Broadcast.create({ title, message, type: type || "info", active: active !== false });
    await pushActivityLog("Broadcast Baru", `"${title}" dibuat.`, "#a78bfa");
    res.json({ success: true, broadcast });
  } catch {
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// ================= UPDATE BROADCAST =================
app.put("/api/broadcasts/:id", async (req, res) => {
  try {
    const { title, message, type, active } = req.body;
    const broadcast = await Broadcast.findByIdAndUpdate(
      req.params.id,
      { title, message, type, active, updated_at: new Date() },
      { new: true }
    );
    if (!broadcast) return res.status(404).json({ success: false, message: "Broadcast tidak ditemukan." });
    res.json({ success: true, broadcast });
  } catch {
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// ================= DELETE BROADCAST =================
app.delete("/api/broadcasts/:id", async (req, res) => {
  try {
    await Broadcast.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
});

// ================= GET APP VERSION =================
app.get("/api/app-version", async (req, res) => {
  try {
    let v = await AppVersion.findOne();
    if (!v) v = await AppVersion.create({ current_version: "0.0.0", latest_version: "0.0.0", download_url: "", notes: "" });
    res.json({
      success: true,
      current_version: v.current_version || "0.0.0",
      latest_version: v.latest_version || "0.0.0",
      download_url: v.download_url,
      notes: v.notes,
      force_update: v.force_update
    });
  } catch {
    res.status(500).json({ success: false });
  }
});

// ================= UPDATE APP VERSION =================
app.put("/api/app-version", async (req, res) => {
  try {
    const { current_version, latest_version, download_url, notes, force_update } = req.body;
    if (!current_version || !latest_version) return res.status(400).json({ success: false, message: "Versi wajib diisi." });
    let v = await AppVersion.findOne();
    if (!v) {
      v = await AppVersion.create({ current_version, latest_version, download_url: download_url || "", notes: notes || "", force_update: force_update !== false });
    } else {
      v.current_version = current_version;
      v.latest_version = latest_version;
      v.download_url = download_url || "";
      v.notes = notes || "";
      v.force_update = force_update !== false;
      v.updated_at = new Date();
      await v.save();
    }
    await pushActivityLog("Update Versi", `Versi diubah — client: v${current_version} | latest: v${latest_version}.`, "#f6ad55");
    res.json({ success: true, current_version: v.current_version, latest_version: v.latest_version });
  } catch {
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// ================= START =================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
