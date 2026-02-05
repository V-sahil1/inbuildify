const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client } = require("@aws-sdk/client-s3");
const path = require("path");
const { allowedFileData } = require("./common");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const fileData = allowedFileData();
const allowedTypes = new RegExp(fileData.types.replace(/^\/|\/$/g, ""), "i");
const fileFilter = (req, file, cb) => {
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    const allowedList = fileData.types
      .replace(/^\/|\/$/g, "")
      .split("|")
      .map((t) => t.replace("image/", "").toUpperCase())
      .map((t) => (t === "JPG" || t === "JPEG" ? "JPG/JPEG" : t))
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .join(", ");
    const message = `Invalid file type. Only the following are allowed: ${allowedList}.`;
    cb(new Error(message));
  }
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
  } else {
    const message = "Invalid file type. Only PDF files are allowed.";
    cb(new Error(message));
  }
};

const createUpload = (folderName = "uploads") =>
  multer({
    storage: multerS3({
      s3: s3Client,
      bucket: process.env.S3_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const filename = `${folderName}/${uniqueSuffix}${path.extname(
          file.originalname,
        )}`;
        cb(null, filename);
      },
      metadata: function (req, file, cb) {
        cb(null, {
          fieldName: file.fieldname,
          originalName: file.originalname,
          uploadedBy: req.user?.users_id || "unknown",
        });
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
    fileFilter: fileFilter,
    limits: {
      fileSize: fileData.size * 1024 * 1024,
    },
  });

const deleteFromS3 = async (fileUrl) => {
  if (!fileUrl) return;

  try {
    const bucketName = process.env.S3_BUCKET_NAME;
    const url = new URL(fileUrl);
    const key = decodeURIComponent(url.pathname.substring(1));

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );
    console.log(`Deleted old file from S3: ${key}`);
  } catch (err) {
    console.error("Error deleting old file from S3:", err.message);
  }
};

const createPdfUpload = (folderName = "pdfs") =>
  multer({
    storage: multerS3({
      s3: s3Client,
      bucket: process.env.S3_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const filename = `${folderName}/${uniqueSuffix}${path.extname(
          file.originalname,
        )}`;
        cb(null, filename);
      },
      metadata: function (req, file, cb) {
        cb(null, {
          fieldName: file.fieldname,
          originalName: file.originalname,
          uploadedBy: req.user?.users_id || "unknown",
        });
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
    fileFilter: pdfFileFilter,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit for PDFs
    },
  });

const createImageOrPdfUpload = (folderName = "uploads") =>
  multer({
    storage: multerS3({
      s3: s3Client,
      bucket: process.env.S3_BUCKET_NAME,
      key: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const filename = `${folderName}/${uniqueSuffix}${path.extname(
          file.originalname,
        )}`;
        cb(null, filename);
      },
      metadata: function (req, file, cb) {
        cb(null, {
          fieldName: file.fieldname,
          originalName: file.originalname,
          uploadedBy: req.user?.users_id || "unknown",
        });
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
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
      } else {
        const imageList = allowedImageExtensions
          .map((t) => t.replace(".", "").toUpperCase())
          .map((t) => (t === "JPG" || t === "JPEG" ? "JPG/JPEG" : t))
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .join(", ");
        const message = `Invalid file type. Only following are allowed: ${imageList}, PDF.`;
        cb(new Error(message));
      }
    },
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit for both images and PDFs
    },
  });

const handleMulterError = (error, req, res, next) => {
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
        message: `Unexpected field name for file upload.`,
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

module.exports = {
  createUpload,
  createPdfUpload,
  createImageOrPdfUpload,
  deleteFromS3,
  handleMulterError,
  s3Client,
};
