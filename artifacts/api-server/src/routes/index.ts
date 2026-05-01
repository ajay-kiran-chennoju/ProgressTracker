import { Router, type IRouter } from "express";
import healthRouter from "./health";
import participantsRouter from "./participants";
import daysRouter from "./days";
import categoriesRouter from "./categories";
import itemsRouter from "./items";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(participantsRouter);
router.use(daysRouter);
router.use(categoriesRouter);
router.use(itemsRouter);
router.use(statsRouter);

export default router;
