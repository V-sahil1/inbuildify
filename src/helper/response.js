const successResponse = (res, data, message = "Success") => {
  res.status(200).json({
    success: true,
    statusCode: 200,
    message,
    data,
  });
};

const errorResponse = (res, statusCode = 500, message = "Internal Server Error") => {
  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    data: null,
  });
};

export default {
  successResponse,
  errorResponse,
};
