import { createServer } from "@graphql-yoga/node";
import { NextApiResponse } from "next/types";
import handler, { Request } from "../../server/api-route";
import prisma from "../../server/db/prisma";
import { getRequestOrigin } from "../../server/get-request-origin";
import { schema } from "../../server/graphql/schema";

export interface GraphQLContext {
  user?: Express.User;
  prisma: typeof prisma;
  origin: string;
}

export const config = {
  api: {
    // Disable body parsing (required for file uploads)
    bodyParser: false,
  },
};

const server = createServer<{
  req: Request;
  res: NextApiResponse;
}>({
  schema,
  context: ({ req }): GraphQLContext => ({
    user: req.user,
    origin: getRequestOrigin(req),
    prisma,
  }),
});

export default handler().use(server);
