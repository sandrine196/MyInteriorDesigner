import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      email: string;
      tier: string;
      isAdmin: boolean;
    };
  }
}
