import express from "express";
import { PrismaClient } from "@prisma/client";
import { IContentRepository, IUserRepository } from "./repositories";
import UserRepository from "./repositories/user";
import { IContentHandler, IUserHandler } from "./handler";
import UserHandler from "./handler/user";
import JWTMiddleware from "./middleware/jwt";
import ContentRepository from "./repositories/content";
import ContentHandler from "./handler/content";
import cors from "cors";
import { RedisClientType, createClient } from "redis";
import { REDIS_URL } from "./utils/const";
import BlacklistRepository from "./repositories/blacklist";

const PORT = Number(process.env.PORT || 8080);
const app = express();
const client = new PrismaClient();
const redisClient: RedisClientType = createClient({
  url: REDIS_URL,
});

client
  .$connect()
  .then(() => redisClient.connect())
  .catch((err) => {
    console.error("Error", err);
  });

const blacklistRepo = new BlacklistRepository(redisClient);

const userRepo: IUserRepository = new UserRepository(client);
const userHandler: IUserHandler = new UserHandler(userRepo, blacklistRepo);

const contentRepo: IContentRepository = new ContentRepository(client);
const contentHandler: IContentHandler = new ContentHandler(contentRepo);

const jwtMiddleware = new JWTMiddleware(blacklistRepo);

app.use(express.json());
app.use(cors());

app.get("/", jwtMiddleware.auth, (req, res) => {
  console.log(res.locals);
  return res.status(200).send("Welcome to LearnHub").end();
});

const userRouter = express.Router();

app.use("/user", userRouter);

userRouter.post("/", userHandler.registration);

userRouter.get("/:username", userHandler.getByUsername);

const authRouter = express.Router();

app.use("/auth", authRouter);

authRouter.post("/login", userHandler.login);

authRouter.get("/logout", jwtMiddleware.auth, userHandler.logout);

authRouter.get("/me", jwtMiddleware.auth, userHandler.gerPersonalInfo);

const contentRouter = express.Router();

app.use("/content", contentRouter);

contentRouter.post("/", jwtMiddleware.auth, contentHandler.create);

contentRouter.get("/", contentHandler.getAll);

contentRouter.get("/:id", contentHandler.getById);

contentRouter.patch("/:id", jwtMiddleware.auth, contentHandler.updateById);

contentRouter.delete("/:id", jwtMiddleware.auth, contentHandler.deleteById);

app.listen(PORT, () => {
  console.log(`LearnHub API is up at ${PORT}`);
});
