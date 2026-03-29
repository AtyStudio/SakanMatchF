import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

/**
 * POST /storage/upload
 *
 * Upload a file directly. Returns an objectPath for storing and serving.
 */
router.post(
  "/storage/upload",
  requireAuth,
  upload.single("file"),
  (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }
    const objectPath = `/api/storage/files/${req.file.filename}`;
    res.json({ objectPath, filename: req.file.filename });
  }
);

/**
 * GET /storage/files/:filename
 *
 * Serve an uploaded file.
 */
router.get("/storage/files/:filename", (req: Request, res: Response) => {
  const { filename } = req.params;
  if (!filename || filename.includes("..") || filename.includes("/")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.sendFile(filePath);
});

/**
 * POST /storage/uploads/request-url
 *
 * Legacy compatibility endpoint — now returns a direct upload path instead of a presigned URL.
 */
router.post(
  "/storage/uploads/request-url",
  requireAuth,
  (_req: AuthRequest, res: Response) => {
    res.status(410).json({
      error: "Presigned URL upload is not available. Use POST /api/storage/upload instead.",
    });
  }
);

export default router;
