import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Optional debug: print registered routes when requested
if (process.env.SHOW_ROUTES === "1") {
  try {
    // app._router.stack contains middleware and mounted routers
    const routes: string[] = [];
    const stack = (app as any)._router?.stack || [];
    for (const layer of stack) {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
        routes.push(`${methods} ${layer.route.path}`);
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        for (const l of layer.handle.stack) {
          if (l.route && l.route.path) {
            const methods = Object.keys(l.route.methods).join(',').toUpperCase();
            routes.push(`${methods} ${layer.regexp && layer.regexp.source ? layer.regexp.source.replace('^\\','').replace('\\/?(?=\\/|$)','') : ''}${l.route.path}`);
          }
        }
      }
    }
    // Print unique routes
    console.log('Registered routes:\n' + Array.from(new Set(routes)).join('\n'));
  } catch (err) {
    // ignore
  }
}

export default app;
