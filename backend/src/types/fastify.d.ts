import type { FastifyReply, FastifyRequest } from "fastify";

export type AgentSessionPayload = {
  type: "agent_session";
  agentId: string;
  email: string;
  referralCode: string;
};

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateAgent: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    agentSession?: AgentSessionPayload;
  }
}
