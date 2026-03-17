import { S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Configure AWS SDK
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const UPLOAD_EXPIRATION = 300; // 5 minutes
const DOWNLOAD_EXPIRATION = 3600; // 5 minutes

// Generate presigned URL for upload
export async function generatePresignedUploadUrl(key, contentType = "application/octet-stream", expiresIn = UPLOAD_EXPIRATION) {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn,
    });

    return {
      success: true,
      url: presignedUrl,
      key,
      expiresIn,
    };
  } catch (error) {
    console.error("Error generating presigned upload URL:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Generate presigned URL for download
export async function generatePresignedDownloadUrl(key, expiresIn = DOWNLOAD_EXPIRATION) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn,
    });

    return {
      success: true,
      url: presignedUrl,
      key,
      expiresIn,
    };
  } catch (error) {
    console.error("Error generating presigned download URL:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Upload file directly (server-side upload)
export async function uploadFile(key, fileBuffer, contentType = "application/octet-stream", metadata = {}) {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: metadata,
    });

    const result = await s3Client.send(command);

    return {
      success: true,
      etag: result.ETag,
      location: `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`,
      key,
    };
  } catch (error) {
    console.error("Error uploading file:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Get object from S3
export async function getObject(key) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const result = await s3Client.send(command);

    // Convert stream to buffer
    const streamToBuffer = async (stream) => {
      const chunks = [];
      return new Promise((resolve, reject) => {
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks)));
      });
    };

    const bodyContents = await streamToBuffer(result.Body);

    return {
      success: true,
      data: bodyContents,
      contentType: result.ContentType,
      lastModified: result.LastModified,
      etag: result.ETag,
      contentLength: result.ContentLength,
    };
  } catch (error) {
    console.error("Error getting object:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Get object as stream (for large files)
export async function getObjectStream(key) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const result = await s3Client.send(command);

    return {
      success: true,
      stream: result.Body,
      contentType: result.ContentType,
      lastModified: result.LastModified,
      etag: result.ETag,
      contentLength: result.ContentLength,
    };
  } catch (error) {
    console.error("Error getting object stream:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Delete single object
export async function deleteObject(key) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const result = await s3Client.send(command);

    return {
      success: true,
      key,
      deleteMarker: result.DeleteMarker,
      versionId: result.VersionId,
    };
  } catch (error) {
    console.error("Error deleting object:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Delete multiple objects
export async function deleteObjects(keys) {
  try {
    const deleteParams = {
      Bucket: BUCKET_NAME,
      Delete: {
        Objects: keys.map(key => ({ Key: key })),
      },
    };

    const result = await s3Client.send(new DeleteObjectsCommand(deleteParams));

    return {
      success: true,
      deleted: result.Deleted,
      errors: result.Errors || [],
    };
  } catch (error) {
    console.error("Error deleting objects:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Check if object exists
export async function objectExists(key) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    return { success: true, exists: true };
  } catch (error) {
    if (error.name === "NoSuchKey") {
      return { success: true, exists: false };
    }
    return {
      success: false,
      error: error.message,
    };
  }
}
