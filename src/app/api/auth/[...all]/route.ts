import { getAuth } from "@/server/auth";

// endpoint ของ Better Auth (callback ของ Google OAuth ฯลฯ)
const handler = (req: Request) => getAuth().handler(req);
export { handler as GET, handler as POST };
