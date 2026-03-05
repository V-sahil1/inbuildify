function extractRoutes(app) {
  const routes = [];

  if (!app._router || !app._router.stack) {
    return routes;
  }

  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: middleware.route.methods,
      });
    } else if (middleware.name === "router" && middleware.handle.stack) {
      const basePath = middleware.regexp
        .toString()
        .replace("/^", "")
        .replace("\\/?(?=\\/|$)/i", "")
        .replace(/\\\//g, "/");

      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: basePath + handler.route.path,
            methods: handler.route.methods,
          });
        }
      });
    }
  });

  return routes;
}

function generateSwaggerSpec(app) {
  const routes = extractRoutes(app);

  const paths = {};

  routes.forEach((route) => {
    if (!paths[route.path]) {
      paths[route.path] = {};
    }

    Object.keys(route.methods).forEach((method) => {
      const lowerMethod = method.toLowerCase();

   // Extract first path segment for grouping
const pathParts = route.path.split("/").filter(Boolean);
const tagName = pathParts.length ? pathParts[0] : "General";

const routeConfig = {
  tags: [tagName.charAt(0).toUpperCase() + tagName.slice(1)],
  summary: `${method.toUpperCase()} ${route.path}`,
  responses: {
    200: {
      description: "Success",
    },
  },
};

      // 🔥 Add requestBody for POST, PUT, PATCH
      if (["post", "put", "patch"].includes(lowerMethod)) {
        routeConfig.requestBody = {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                example: {}, // You can add default fields here
              },
            },
          },
        };
      }

      paths[route.path][lowerMethod] = routeConfig;
    });
  });

  return {
    openapi: "3.0.0",
    info: {
      title: "CRM API",
      version: "1.0.0",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    paths,
  };
}
module.exports = generateSwaggerSpec;