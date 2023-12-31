import { RequestHandler } from "express";
import { IContentHandler } from ".";
import { IContentDto, ICreateContentDto } from "../dto/content";
import { IErrorDto } from "../dto/error";
import { AuthStatus } from "../middleware/jwt";
import { IContentRepository } from "../repositories";
import { getOEmbedInfo } from "../utils/oembed";
import mapToDto from "../utils/content.mapper";
import contentMapper from "../utils/content.mapper";
import { IUpdateContent } from "../repositories";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

export default class ContentHandler implements IContentHandler {
  private repo: IContentRepository;
  constructor(repo: IContentRepository) {
    this.repo = repo;
  }

  public getAll: IContentHandler["getAll"] = async (req, res) => {
    const result = await this.repo.getAll();

    return res.status(200).json(result).end();
  };

  public getById: IContentHandler["getById"] = async (req, res) => {
    const { id } = req.params;

    const numericId = Number(id);

    if (isNaN(numericId))
      return res.status(400).json({ message: "id is invalid" }).end();

    const content = await this.repo.getById(numericId);

    return res.status(200).json(contentMapper(content)).end();
  };

  create: IContentHandler["create"] = async (req, res) => {
    const { rating, videoUrl, comment } = req.body;

    if (isNaN(Number(rating)) || rating < 0 || rating > 5)
      return res
        .status(400)
        .json({ message: "rating is out of range 0-5" })
        .end();

    try {
      const { author_name, url, thumbnail_url, title } = await getOEmbedInfo(
        videoUrl
      );

      const data = await this.repo.create(res.locals.user.id, {
        rating,
        videoUrl,
        comment,
        creatorName: author_name,
        creatorUrl: url,
        thumbnailUrl: thumbnail_url,
        videoTitle: title,
      });

      return res.status(201).json(mapToDto(data)).end();
    } catch (error) {
      console.error(error);
      if (error instanceof URIError)
        return res.status(400).json({ message: error.message }).end();

      return res.status(500).json({ message: "Internal Server Error" }).end();
    }
  };

  public updateById: IContentHandler["updateById"] = async (req, res) => {
    try {
      const { id } = req.params;
      const { comment, rating } = req.body;

      const numericId = Number(id);

      if (isNaN(numericId))
        return res.status(400).json({ message: "id is invalid" }).end();

      const {
        postedBy: { id: ownerId },
      } = await this.repo.getById(numericId);

      if (ownerId !== res.locals.user.id)
        return res
          .status(403)
          .json({ message: "Request content is forbidden" })
          .end();

      if (typeof comment !== "string")
        return res
          .status(400)
          .json({ message: "comment is invalid text type" })
          .end();

      if (isNaN(Number(rating)) || rating > 5 || rating < 0)
        return res.status(400).send({ message: "rating is invalid" });

      const result = await this.repo.partialUpdate(Number(req.params.id), {
        comment,
        rating,
      });
      return res.status(200).json(result).end();
    } catch (error) {
      console.error(error);
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === "P2025"
      )
        return res.status(410).json({ message: "content not found" }).end();

      if (error instanceof TypeError)
        return res.status(400).json({ message: error.message }).end();

      return res.status(500).json({
        message: `Internal Server Error`,
      });
    }
  };

  public deleteById: IContentHandler["deleteById"] = async (req, res) => {
    try {
      if (isNaN(Number(req.params.id)))
        return res.status(400).json({ message: "id is invalid" });

      const {
        postedBy: { id: ownerId },
      } = await this.repo.getById(Number(req.params.id));
      if (ownerId !== res.locals.user.id)
        return res
          .status(403)
          .json({ message: "You're not the owner of this content!" });

      const result = await this.repo.delete(Number(req.params.id));

      return res.status(200).json(result).end();
    } catch (error) {
      console.error(error);
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === "P2025"
      )
        return res.status(410).json({ message: "content not found" }).end();

      if (error instanceof TypeError)
        return res.status(400).json({ message: error.message }).end();

      return res.status(500).json({
        message: `Internal Server Error`,
      });
    }
  };
}
