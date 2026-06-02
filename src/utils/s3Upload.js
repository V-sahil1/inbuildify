import path from "path";

import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../config/env.config.js";
import { allowedFileData } from "./common.js";

export const s3Client = new S3Client({
  region: env.AWS.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS.AWS_SECRET_ACCESS_KEY,
  },
});

const fileData = allowedFileData();
const fileFilter = (req, file, cb) => {
  const types = (fileData?.types || "").toLowerCase().split("|");
  const extension = path.extname(file.originalname).toLowerCase().replace(".", "");

  const isMimeAllowed = types.includes(file.mimetype.toLowerCase());
  const isExtAllowed = types.some(t => t.includes(extension) || t === extension);

  if (isMimeAllowed || isExtAllowed) {
    return cb(null, true);
  }
  const allowedList = types
    .map((t) => t.replace("image/", "").toUpperCase())
    .map((t) => (t === "JPG" || t === "JPEG" ? "JPG/JPEG" : t))
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(", ");
  const message = `Invalid file type. Only the following are allowed: ${allowedList}.`;
  cb(new Error(message));

};

const pdfFileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["application/pdf"];
  const allowedExtensions = [".pdf"];

  const extname = allowedExtensions.includes(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedMimeTypes.includes(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  }
};

const imageFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

  const extname = allowedExtensions.includes(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedMimeTypes.includes(file.mimetype.toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  }
  const message = "Invalid file type. Only image files are allowed.";
  cb(new Error(message));
};


// Helper to attach file field metadata to Multer middleware for Swagger gen
const wrapMulter = (upload) => {
  const methodsToWrap = ["single", "array", "fields", "any"];

  methodsToWrap.forEach((method) => {
    const original = upload[method];
    if (original) {
      upload[method] = function (...args) {
        const mw = original.apply(this, args);

        if (method === "single") {
          mw.fileFields = [{ name: args[0], maxCount: 1 }];
        } else if (method === "array") {
          mw.fileFields = [{ name: args[0], maxCount: args[1] || undefined }];
        } else if (method === "fields") {
          mw.fileFields = args[0] || [];
        } else if (method === "any") {
          mw.fileFields = "any";
        }

        return mw;
      };
    }
  });

  return upload;
};

export const createUpload = (folderName = "uploads") =>
  wrapMulter(multer({
    storage: multerS3({
      s3: s3Client,
      bucket: env.AWS.S3_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const originalName = file.originalname.replace(/\s+/g, "_");
        const filename = `${folderName}/${uniqueSuffix}-${originalName}`;
        cb(null, filename);
      },
      metadata(req, file, cb) {
        cb(null, {
          fieldName: file.fieldname,
          originalName: encodeURIComponent(file.originalname),
          uploadedBy: req.user?.users_id || "unknown",
        });
      },
      contentType: function (req, file, cb) {
        cb(null, file.mimetype);
      },
    }),
    fileFilter,
    limits: {
      fileSize: fileData.size * 1024 * 1024,
    },
  }));

export const deleteFromS3 = async (fileUrl) => {
  if (!fileUrl || typeof fileUrl !== "string") {
    return;
  }

  try {
    const bucketName = env.AWS.S3_BUCKET_NAME;
    let key;

    // If it's a full URL, extract the key
    if (fileUrl.startsWith("http")) {
      try {
        const url = new URL(fileUrl);
        key = decodeURIComponent(url.pathname.substring(1));

        // If the bucket name is part of the path (e.g. s3.amazonaws.com/bucket/key)
        if (key.startsWith(`${bucketName}/`)) {
          key = key.substring(bucketName.length + 1);
        }
      } catch (e) {
        key = fileUrl;
      }
    } else {
      // Assume it's already a key
      key = fileUrl;
    }

    if (!key) {
      return;
    }

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );
    console.log(`Successfully deleted from S3: ${key}`);
  } catch (err) {
    console.error("Error deleting from S3:", fileUrl, "-", err.message);
  }
};

export const createPdfUpload = (folderName = "pdfs") =>
  wrapMulter(multer({
    storage: multerS3({
      s3: s3Client,
      bucket: env.AWS.S3_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const originalName = file.originalname.replace(/\s+/g, "_");
        const filename = `${folderName}/${uniqueSuffix}-${originalName}`;
        cb(null, filename);
      },
      metadata(req, file, cb) {
        cb(null, {
          fieldName: file.fieldname,
          originalName: encodeURIComponent(file.originalname),
          uploadedBy: req.user?.users_id || "unknown",
        });
      },
      contentType: function (req, file, cb) {
        cb(null, file.mimetype);
      },
    }),
    fileFilter: pdfFileFilter,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit for PDFs
    },
  }));

export const createImageUpload = (folderName = "uploads") =>
  wrapMulter(multer({
    storage: multerS3({
      s3: s3Client,
      bucket: env.AWS.S3_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const originalName = file.originalname.replace(/\s+/g, "_");
        const filename = `${folderName}/${uniqueSuffix}-${originalName}`;
        cb(null, filename);
      },
      metadata(req, file, cb) {
        cb(null, {
          fieldName: file.fieldname,
          originalName: encodeURIComponent(file.originalname),
          uploadedBy: req.user?.users_id || "unknown",
        });
      },
      contentType: function (req, file, cb) {
        cb(null, file.mimetype);
      },
    }),
    fileFilter: imageFileFilter,
    limits: {
      fileSize: fileData.size * 1024 * 1024,
    },
  }));

export const createImageOrPdfUpload = (folderName = "uploads") =>
  wrapMulter(multer({
    storage: multerS3({
      s3: s3Client,
      bucket: env.AWS.S3_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const originalName = file.originalname.replace(/\s+/g, "_");
        const filename = `${folderName}/${uniqueSuffix}-${originalName}`;
        cb(null, filename);
      },
      metadata(req, file, cb) {
        cb(null, {
          fieldName: file.fieldname,
          originalName: encodeURIComponent(file.originalname),
          uploadedBy: req.user?.users_id || "unknown",
        });
      },
      contentType: function (req, file, cb) {
        cb(null, file.mimetype);
      },
    }),
    fileFilter: (req, file, cb) => {
      // Allowed image types
      const allowedImageMimeTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      const allowedImageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

      // Allowed PDF types
      const allowedPdfMimeTypes = ["application/pdf"];
      const allowedPdfExtensions = [".pdf"];

      // Combine all allowed types
      const allowedMimeTypes = [
        ...allowedImageMimeTypes,
        ...allowedPdfMimeTypes,
      ];
      const allowedExtensions = [
        ...allowedImageExtensions,
        ...allowedPdfExtensions,
      ];

      const extname = allowedExtensions.includes(
        path.extname(file.originalname).toLowerCase(),
      );
      const mimetype = allowedMimeTypes.includes(file.mimetype);

      if (mimetype && extname) {
        return cb(null, true);
      }
      const imageList = allowedImageExtensions
        .map((t) => t.replace(".", "").toUpperCase())
        .map((t) => (t === "JPG" || t === "JPEG" ? "JPG/JPEG" : t))
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .join(", ");
      const message = `Invalid file type. Only following are allowed: ${imageList}, PDF.`;
      cb(new Error(message));

    },
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit for both images and PDFs
    },
  }));

export const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      // Check if this is from the new imageOrPdfUpload function
      const isImageOrPdf = error.limit === 50 * 1024 * 1024;
      const maxSize = isImageOrPdf ? "50MB" : `${fileData.size}MB`;

      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: `File size too large. Maximum size is ${maxSize}.`,
        data: null,
      });
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Unexpected field name for file upload.",
        data: null,
      });
    }
  }
  if (error.message?.startsWith("Invalid file type")) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: error.message,
      data: null,
    });
  }

  next(error);
};

export default {
  createUpload,
  createPdfUpload,
  createImageUpload,
  createImageOrPdfUpload,
  deleteFromS3,
  handleMulterError,
  s3Client,
};