const { errorResponse } = require('../helper/response');

exports.createBuilder = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const builder = await Builder.create({ name, email });
    successResponse(res, {
      statusCode: 201,
      message: "Builder created successfully",
      data: builder,
      requestId: req.requestId
    });
  } catch (err) {
    errorResponse(res, 500, err.message);
  }
};

exports.getBuilders = async (req, res, next) => {
  try {
    const builders = await Builder.findAll();
    successResponse(res, {
      statusCode: 200,
      message: "Builders fetched successfully",
      data: builders,
      requestId: req.requestId
    });
  } catch (err) {
    errorResponse(res, 500, err.message);
  }
};

exports.getBuilderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const builder = await Builder.findByPk(id);
    if (!builder) {
      return errorResponse(res, 404, "Builder not found");
    }
    successResponse(res, {
      statusCode: 200,
      message: "Builder fetched successfully",
      data: builder,
      requestId: req.requestId
    });
  } catch (err) {
    errorResponse(res, 500, err.message);
  }
};

exports.updateBuilder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;
    const [affectedRows] = await Builder.update({ name, email }, { where: { id } });
    if (affectedRows === 0) {
      return errorResponse(res, 404, "Builder not found");
    }
    successResponse(res, {
      statusCode: 200,
      message: "Builder updated successfully",
      data: null,
      requestId: req.requestId
    });
  } catch (err) {
    errorResponse(res, 500, err.message);
  }
};

exports.deleteBuilder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [affectedRows] = await Builder.destroy({ where: { id } });
    if (affectedRows === 0) {
      return errorResponse(res, 404, "Builder not found");
    }
    successResponse(res, {
      statusCode: 200,
      message: "Builder deleted successfully",
      data: null,
      requestId: req.requestId
    });
  } catch (err) {
    errorResponse(res, 500, err.message);
  }
};
