import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import listingsRouter from "./listings";
import paypalRouter from "./paypal";
import premiumRouter from "./premium";
import storageRouter from "./storage";
import preferencesRouter from "./preferences";
import favoritesRouter from "./favorites";
import requestsRouter from "./requests";
import messagesRouter from "./messages";
import profilesRouter from "./profiles";
import matchesRouter from "./matches";
import donationsRouter from "./donations";
import chatRequestsRouter from "./chatRequests";
import surveyRouter from "./survey";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/listings", listingsRouter);
router.use("/paypal", paypalRouter);
router.use("/premium", premiumRouter);
router.use(storageRouter);
router.use("/preferences", preferencesRouter);
router.use("/favorites", favoritesRouter);
router.use("/requests", requestsRouter);
router.use("/messages", messagesRouter);
router.use("/profile", profilesRouter);
router.use("/matches", matchesRouter);
router.use("/donations", donationsRouter);
router.use("/chat-requests", chatRequestsRouter);
router.use(surveyRouter);

export default router;
