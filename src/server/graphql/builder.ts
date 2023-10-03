import SchemaBuilder from "@pothos/core";
import SimpleObjectsPlugin from "@pothos/plugin-simple-objects";
import RelayPlugin from "@pothos/plugin-relay";
import PrismaPlugin from "@pothos/plugin-prisma";
import type PrismaTypes from "@pothos/plugin-prisma/generated";
import { GraphQLContext } from "../../pages/api";
import prisma from "../db/prisma";

const builder = new SchemaBuilder<{
  Context: GraphQLContext;
  PrismaTypes: PrismaTypes;
}>({
  plugins: [SimpleObjectsPlugin, RelayPlugin, PrismaPlugin],
  relayOptions: {
    clientMutationId: "omit",
    cursorType: "String",
  },
  prisma: {
    client: prisma,
    exposeDescriptions: true,
    filterConnectionTotalCount: true,
  },
});

// Add root Query and Mutation types to schema
builder.queryType({});
builder.mutationType({});

export default builder;
