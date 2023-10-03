import prisma from "../../db/prisma";
import { getProjectPaidPlan } from "../../get-project-paid-plan";
import { plans } from "../../stripe/plans";
import slug from "slug";
import { generateInvitationToken } from "../../invitations/token";
import { sendEmail } from "../../send-email";
import stripe from "../../stripe";
import builder from "../builder";

export const PaidPlan = builder.enumType("PaidPlan", {
  values: Object.keys(plans) as Array<keyof typeof plans>,
});

export const Project = builder.prismaObject("Project", {
  fields: (t) => ({
    id: t.exposeString("id", { nullable: false }),
    name: t.exposeString("name", { nullable: true }),
    slug: t.exposeString("slug", { nullable: true }),

    paidPlan: t.field({
      type: PaidPlan,
      nullable: true,
      resolve: async ({ id }, _, ctx) => {
        if (!ctx.user?.id) return null;

        // This makes sure the user has access to the project
        const project = await prisma.project.findFirst({
          where: {
            users: {
              some: {
                id: ctx.user.id,
              },
            },
            id,
          },
        });

        return getProjectPaidPlan(project);
      },
    }),

    users: t.relatedConnection("users", {
      cursor: "id",
    }),
  }),
});

builder.queryFields((t) => ({
  project: t.field({
    type: Project,
    args: {
      id: t.arg.string({ required: false }),
      slug: t.arg.string({ required: false }),
    },
    nullable: true,
    resolve: async (_, { id, slug }, ctx) => {
      if (!ctx.user?.id) return null;
      if ((!id && !slug) || (id && slug))
        throw new Error(
          "Please provide either an ID or a slug to the project query"
        );

      const project = await prisma.project.findFirst({
        where: {
          users: {
            some: {
              id: ctx.user.id,
            },
          },
          // Note: TypeScript doesn't understand that one is for sure defined here
          id: id as string,
          slug: slug as string,
        },
      });

      if (!project) return null;

      return project;
    },
  }),
}));

builder.mutationFields((t) => ({
  createProject: t.field({
    type: Project,
    args: {
      name: t.arg.string({ required: true }),
      slug: t.arg.string({ required: false }),
    },
    nullable: true,
    resolve: async (_, args, ctx) => {
      if (!ctx.user?.id) return null;

      return await prisma.project.create({
        data: {
          name: args.name,
          slug: args.slug || slug(args.name),
          users: {
            connect: {
              id: ctx.user.id,
            },
          },
        },
      });
    },
  }),

  createStripeCheckoutBillingPortalUrl: t.field({
    nullable: true,
    type: "String",
    args: {
      projectId: t.arg.string({ required: true }),
    },
    resolve: async (_, { projectId }, ctx) => {
      if (!ctx.user?.id) return null;

      const project = await prisma.project.findFirst({
        where: {
          users: {
            some: {
              id: ctx.user.id,
            },
          },
          id: projectId,
        },
      });

      if (!project || !project.stripeCustomerId) return null;

      const { url } = await stripe.billingPortal.sessions.create({
        customer: project.stripeCustomerId,
        return_url: `${ctx.origin}/app/${project.slug}/settings`,
      });

      return url;
    },
  }),

  createStripeCheckoutSession: t.field({
    nullable: true,
    type: "String",
    args: {
      plan: t.arg({ type: PaidPlan, required: true }),
      projectId: t.arg.string({ required: true }),
    },
    resolve: async (_, { projectId, plan }, ctx) => {
      if (!ctx.user?.id) return null;

      const priceId = plans[plan];

      if (!priceId) return null;

      const project = await prisma.project.findFirst({
        where: {
          users: {
            some: {
              id: ctx.user.id,
            },
          },
          id: projectId,
        },
      });

      if (!project) return null;

      // checkout.sessions.create can only be called with *either* a customer ID (if it exists) *or* a customer_email (if no ID exists yet)
      const customerMetadata = project.stripeCustomerId
        ? {
            customer: project.stripeCustomerId,
          }
        : {
            customer_email: ctx.user.email,
          };

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        metadata: {
          projectId,
          userId: ctx.user.id,
        },
        allow_promotion_codes: true,
        ...customerMetadata,
        billing_address_collection: "auto",
        success_url: `${ctx.origin}/app/${project.slug}/?upgraded=true`,
        cancel_url: `${ctx.origin}/app/${project.slug}`,
      });

      return session.id;
    },
  }),

  inviteToProject: t.field({
    nullable: true,
    type: "Boolean",
    args: {
      projectId: t.arg.string({ required: true }),
      email: t.arg.string({ required: true }),
    },
    resolve: async (_, { projectId, email }, ctx) => {
      if (!ctx.user?.id) return null;

      const inviter = await prisma.user.findUnique({
        where: {
          id: ctx.user.id,
        },
      });

      const project = await prisma.project.findFirst({
        where: {
          users: {
            some: {
              id: ctx.user.id,
            },
          },
          id: projectId,
        },
      });

      if (!project || !inviter) return null;

      const token = generateInvitationToken({
        destination: email,
        projectId,
      });

      await sendEmail({
        to: email,
        subject: `${inviter.name || inviter.email} invited you`,
        text: `Hey! Click on this link to accept your invite: ${ctx.origin}/api/invitations/accept/?token=${token}`,
      });

      return true;
    },
  }),

  removeUserFromProject: t.field({
    nullable: true,
    type: Project,
    args: {
      projectId: t.arg.string({ required: true }),
      userId: t.arg.string({ required: true }),
    },
    resolve: async (_, { projectId, userId }, ctx) => {
      if (!ctx.user?.id) return null;

      const hasAccess = await prisma.project.findFirst({
        where: {
          users: {
            some: {
              id: ctx.user.id,
            },
          },
          id: projectId,
        },
      });

      if (!hasAccess) return null;

      const project = await prisma.project.update({
        where: {
          id: projectId,
        },
        data: {
          users: {
            disconnect: {
              id: userId,
            },
          },
        },
      });

      return project;
    },
  }),
}));
