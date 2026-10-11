import { IdentityController } from "@/controllers/identity.controller";

export const GET = (request: Request) => IdentityController.callback(request);
