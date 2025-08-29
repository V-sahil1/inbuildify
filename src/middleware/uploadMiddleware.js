const { S3Client } = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

const createUpload = (options = {}) => {
  const {
    allowedMimeTypes = ["image/"],
    maxFileSize = 10 * 1024 * 1024, // 10 MB default
    defaultPath = "uploads"
  } = options;

  return multer({
    storage: multerS3({
      s3: s3Client,
      bucket: BUCKET_NAME,
      acl: "public-read",
      metadata: (req, file, cb) => {
        cb(null, { 
          fieldName: file.fieldname,
          uploadedBy: req.user?.id || 'anonymous',
          uploadedAt: new Date().toISOString()
        });
      },
      key: (req, file, cb) => {
        // Get dynamic path from request
        const dynamicPath = defaultPath;
        
        // Sanitize the path to prevent directory traversal
        const sanitizedPath = dynamicPath.replace(/[^a-zA-Z0-9-_/]/g, '').replace(/\/+/g, '/');
        
        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        const fileExtension = path.extname(file.originalname);
        const fileName = `${timestamp}_${randomString}${fileExtension}`;
        
        const fullPath = `${sanitizedPath}/${fileName}`;
        
        console.log(`Uploading file to: ${fullPath}`);
        cb(null, fullPath);
      },
    }),
    limits: {
      fileSize: maxFileSize,
    },
    fileFilter: (req, file, cb) => {
      const isAllowed = allowedMimeTypes.some(type => 
        file.mimetype.startsWith(type.replace('/', ''))
      );
      
      if (isAllowed) {
        cb(null, true);
      } else {
        cb(new Error(`Only ${allowedMimeTypes.join(', ')} files are allowed!`), false);
      }
    },
  });
};

module.exports = {
    createUpload
};
