import prisma from "../../db/prisma";
import builder from "../builder";

export const User = builder.prismaObject("User", {
  fields: (t) => ({
    id: t.exposeString("id"),
    name: t.exposeString("name", { nullable: true }),
    email: t.exposeString("email"),

    projects: t.relatedConnection("projects", {
      cursor: "id",
    }),
  }),
});

builder.queryFields((t) => ({
  currentUser: t.field({
    type: User,
    nullable: true,
    resolve: (_, __, ctx) => {
      if (!ctx.user?.id) return null;

      return prisma.user.findUnique({
        where: {
          id: ctx.user.id,
        },
      });
    },
  }),
}));

builder.mutationFields((t) => ({
  updateUser: t.field({
    type: User,
    nullable: true,
    args: {
      userId: t.arg.string({ required: true }),
      name: t.arg.string({ required: false }),
    },

    resolve: async (_, { userId, name }, ctx) => {
      if (!ctx.user?.id || userId !== ctx.user.id) return null;

      return await prisma.user.update({
        where: { id: userId },
        data: { name },
      });
    },
  }),
}));
