const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const Resource = require("../models/Resource");
const Domain = require("../models/Domain");
const authMiddleware = require("../middleware/authMiddleware");
const { generateEmbedding } = require("../services/embeddingService");

const router = express.Router();

const uploadsDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const sanitized = file.originalname.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    const uniqueName = `${Date.now()}-${sanitized}`;

    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
    if (
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  }
});

function chunkText(
  text,
  { maxWords = 400, overlapWords = 80 } = {}
) {
  if (!text || !text.trim()) {
    return [];
  }

  const cleaned = text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  const words = cleaned.split(/\s+/);

  if (words.length <= maxWords) {
    return [cleaned];
  }

  const chunks = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + maxWords, words.length);
    const chunkWords = words.slice(start, end);
    const currentChunk = chunkWords.join(" ");

    if (currentChunk.trim().length > 30) {
      chunks.push(currentChunk.trim());
    }

    start += maxWords - overlapWords;

    if (start >= words.length) {
      break;
    }
  }

  return chunks;
}

function cleanPdfText(text) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

function normalizeHeadingText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/[ \t]+$/g, "")
    .trim();
}

function isTopLevelSectionHeading(line) {
  const match = line.match(
    /^(\d{1,2})\.\s+([A-Z][A-Z0-9 &,'’()\/-]{2,})$/
  );

  if (!match) {
    return null;
  }

  return {
    sectionNumber: match[1],
    heading: normalizeHeadingText(match[2])
  };
}

function extractSectionHeadingFromLine(line) {
  const match = line.match(
    /^(\d{1,2})\.\s+([A-Z][A-Z0-9 &,'’()\/-]{2,}?)(?=\s+\d{1,2}\.\d+\b|$)/
  );

  if (!match) {
    return null;
  }

  return {
    sectionNumber: match[1],
    heading: normalizeHeadingText(match[2])
  };
}

function splitPageIntoSections(pageText, pageNumber) {
  if (!pageText || !pageText.trim()) {
    return [];
  }

  const lines = pageText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    let heading = isTopLevelSectionHeading(line);

    if (!heading) {
      heading = extractSectionHeadingFromLine(line);
    }

    if (heading) {
      if (currentSection) {
        const cleanedText = cleanPdfText(currentSection.text);

        if (cleanedText.length > 30) {
          sections.push({
            sectionNumber: currentSection.sectionNumber,
            heading: currentSection.heading,
            text: cleanedText,
            pageStart: currentSection.pageStart,
            pageEnd: pageNumber
          });
        }
      }

      currentSection = {
        sectionNumber: heading.sectionNumber,
        heading: heading.heading,
        text: line,
        pageStart: pageNumber,
        pageEnd: pageNumber
      };

      continue;
    }

    if (currentSection) {
      currentSection.text += "\n" + line;
      currentSection.pageEnd = pageNumber;
    }
  }

  if (currentSection) {
    const cleanedText = cleanPdfText(currentSection.text);

    if (cleanedText.length > 30) {
      sections.push({
        sectionNumber: currentSection.sectionNumber,
        heading: currentSection.heading,
        text: cleanedText,
        pageStart: currentSection.pageStart,
        pageEnd: currentSection.pageEnd
      });
    }
  }

  return sections;
}

function buildSectionChunks(pages) {
  const sections = [];
  let currentSection = null;

  for (const page of pages) {
    const pageSections = splitPageIntoSections(
      page.text,
      page.pageNumber
    );

    if (pageSections.length === 0) {
      if (currentSection) {
        const extraText = cleanPdfText(page.text);

        if (extraText) {
          currentSection.text += "\n" + extraText;
        }

        currentSection.pageEnd = page.pageNumber;
      }

      continue;
    }

    for (const section of pageSections) {
      if (currentSection) {
        sections.push(currentSection);
      }

      currentSection = {
        sectionNumber: section.sectionNumber,
        heading: section.heading,
        text: section.text,
        pageStart: section.pageStart,
        pageEnd: section.pageEnd
      };
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

async function renderPdfPage(pageData) {
  const renderOptions = {
    normalizeWhitespace: false,
    disableCombineTextItems: false
  };

  const textContent =
    await pageData.getTextContent(renderOptions);

  const lines = [];

  for (const item of textContent.items) {
    const rawText = item.str || "";
    const text = rawText.trim();

    if (!text) {
      continue;
    }

    const y = item.transform
      ? Math.round(item.transform[5])
      : 0;

    let line = null;

    for (const existingLine of lines) {
      if (Math.abs(existingLine.y - y) <= 2) {
        line = existingLine;
        break;
      }
    }

    if (!line) {
      line = {
        y,
        items: []
      };

      lines.push(line);
    }

    line.items.push({
      x: item.transform
        ? item.transform[4]
        : 0,
      text: rawText
    });
  }

  lines.sort((a, b) => b.y - a.y);

  const pageLines = lines.map((line) => {
    line.items.sort((a, b) => a.x - b.x);

    return line.items
      .map((item) => item.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  });

  const pageText = pageLines
    .filter(Boolean)
    .join("\n");

  return (
    `\n\n---PAGE_${pageData.pageIndex + 1}---\n\n` +
    pageText
  );
}

router.get(
  "/user/all",
  authMiddleware,
  async (req, res) => {
    try {
      const userDomains = await Domain.find({
        createdBy: req.user.userId
      }).select("_id name");

      const domainMap = {};

      const domainIds = userDomains.map((d) => {
        domainMap[d._id.toString()] = d.name;
        return d._id;
      });

      const resources = await Resource.find({
        domainId: { $in: domainIds }
      }).sort({ createdAt: -1 });

      const enrichedResources = resources.map((r) => {
        const obj = r.toObject();

        obj.domainName =
          domainMap[r.domainId.toString()] ||
          "Unknown Domain";

        return obj;
      });

      res.json(enrichedResources);
    } catch (error) {
      res.status(500).json({
        message: "Failed to fetch all resources",
        error: error.message
      });
    }
  }
);







router.post(
  "/generate-embeddings",
  authMiddleware,
  async (req, res) => {
    try {
      const domains =
        await Domain.find({
          createdBy:
            req.user.userId
        });

      const domainIds =
        domains.map(
          (domain) =>
            domain._id
        );

      const resources =
        await Resource.find({
          domainId: {
            $in: domainIds
          }
        });

      let updated = 0;

      for (
        const resource of resources
      ) {
        const resourceText =
          `${resource.title}. ` +
          `${(
            resource.content || ""
          ).slice(0, 4000)}`;

        const embedding =
          await generateEmbedding(
            resourceText
          );

        resource.embedding =
          embedding;

        await resource.save();

        updated++;
      }

      res.json({
        message:
          "All embeddings regenerated successfully",
        updated
      });
    } catch (error) {
      console.error(
        "Embedding generation error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to generate embeddings",
        error:
          error.message
      });
    }
  }
);









router.get(
  "/:domainId",
  authMiddleware,
  async (req, res) => {
    try {
      const domain = await Domain.findOne({
        _id: req.params.domainId,
        createdBy: req.user.userId
      });

      if (!domain) {
        return res.status(404).json({
          message: "Domain not found"
        });
      }

      const resources = await Resource.find({
        domainId: req.params.domainId
      }).sort({ createdAt: -1 });

      res.json(resources);
    } catch (error) {
      res.status(500).json({
        message: "Failed to fetch resources",
        error: error.message
      });
    }
  }
);

router.post(
  "/upload-pdf",
  authMiddleware,
  upload.single("pdf"),
  async (req, res) => {
    try {
      const { domainId } = req.body;

      if (!domainId) {
        if (
          req.file &&
          fs.existsSync(req.file.path)
        ) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(400).json({
          message: "Domain ID is required"
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "PDF file is required"
        });
      }

      const domain = await Domain.findOne({
        _id: domainId,
        createdBy: req.user.userId
      });

      if (!domain) {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(404).json({
          message: "Domain not found"
        });
      }

      const pdfBuffer =
        fs.readFileSync(req.file.path);

      const pdfData = await pdfParse(
        pdfBuffer,
        {
          pagerender: renderPdfPage
        }
      );

      const extractedText =
        (pdfData.text || "").trim();

      if (!extractedText) {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(400).json({
          message:
            "Could not extract text from this PDF. Please ensure it is not scanned/empty."
        });
      }

      const fileUrl =
        `/uploads/${path.basename(req.file.path)}`;

      const pdfTitle =
        req.file.originalname;

      const rawPages = extractedText
        .split(/---PAGE_(\d+)---/)
        .filter(Boolean);

      const pages = [];

      for (
        let i = 0;
        i < rawPages.length;
        i += 2
      ) {
        const pageNumber =
          rawPages[i];

        const pageText =
          rawPages[i + 1];

        if (
          pageText &&
          pageText.trim()
        ) {
          pages.push({
            pageNumber: Number(pageNumber),
            text: pageText.trim()
          });
        }
      }

      const sectionChunks =
        buildSectionChunks(pages);

      console.log(
        `Detected ${sectionChunks.length} sections in "${pdfTitle}"`
      );

      for (const section of sectionChunks) {
        console.log(
          `Section ${section.sectionNumber}: ${section.heading} | Pages ${section.pageStart}-${section.pageEnd}`
        );
      }

      if (sectionChunks.length > 0) {
        const savedResources = [];

        for (const section of sectionChunks) {
          let content =
            cleanPdfText(section.text);

          if (content.length > 6000) {
            content =
              content.slice(0, 6000);
          }

          const chunkTitle =
            `${pdfTitle} [Section ${section.sectionNumber}: ${section.heading}]`;

          const textToEmbed =
            `${pdfTitle}. ` +
            `Section ${section.sectionNumber}. ` +
            `${section.heading}. ` +
            `${content}`;

          const embedding =
            await generateEmbedding(
              textToEmbed
            );

          const resource =
            new Resource({
              domainId,
              type: "pdf",
              title: chunkTitle,
              content,
              fileName:
                req.file.originalname,
              filePath:
                savedResources.length === 0
                  ? req.file.path
                  : "",
              fileUrl,
              embedding
            });

          await resource.save();

          savedResources.push(resource);
        }

        console.log(
          `PDF "${pdfTitle}" split into ${savedResources.length} section-based resources.`
        );

        return res.status(201).json({
          message:
            `PDF uploaded and split into ${savedResources.length} section-based searchable resources!`,
          resource:
            savedResources[0],
          totalChunks:
            savedResources.length,
          chunkingMethod:
            "section-based"
        });
      }

      const fallbackChunks = [];

      for (const page of pages) {
        const chunks =
          chunkText(page.text, {
            maxWords: 400,
            overlapWords: 80
          });

        for (
          let i = 0;
          i < chunks.length;
          i++
        ) {
          fallbackChunks.push({
            pageNumber:
              page.pageNumber,
            text: chunks[i],
            partNumber: i + 1,
            totalParts:
              chunks.length
          });
        }
      }

      if (fallbackChunks.length === 0) {
        const textToEmbed =
          `${pdfTitle}. ` +
          extractedText.slice(0, 4000);

        const embedding =
          await generateEmbedding(
            textToEmbed
          );

        const resource =
          new Resource({
            domainId,
            type: "pdf",
            title: pdfTitle,
            content: extractedText,
            fileName:
              req.file.originalname,
            filePath: req.file.path,
            fileUrl,
            embedding
          });

        await resource.save();

        return res.status(201).json({
          message:
            "PDF uploaded and embedded successfully",
          resource
        });
      }

      const savedResources = [];

      for (
        const chunk of fallbackChunks
      ) {
        const chunkTitle =
          `${pdfTitle} [Page ${chunk.pageNumber} - Part ${chunk.partNumber}/${chunk.totalParts}]`;

        const textToEmbed =
          `${pdfTitle}. ` +
          `Page ${chunk.pageNumber}. ` +
          `${chunk.text}`;

        const embedding =
          await generateEmbedding(
            textToEmbed
          );

        const resource =
          new Resource({
            domainId,
            type: "pdf",
            title: chunkTitle,
            content: chunk.text,
            fileName:
              req.file.originalname,
            filePath:
              savedResources.length === 0
                ? req.file.path
                : "",
            fileUrl,
            embedding
          });

        await resource.save();

        savedResources.push(resource);
      }

      console.log(
        `PDF "${pdfTitle}" used fallback page/text chunking with ${savedResources.length} resources.`
      );

      res.status(201).json({
        message:
          `PDF uploaded and split into ${savedResources.length} searchable chunks!`,
        resource:
          savedResources[0],
        totalChunks:
          savedResources.length,
        chunkingMethod:
          "fallback"
      });
    } catch (error) {
      console.error(
        "PDF upload error:",
        error
      );

      if (
        req.file &&
        fs.existsSync(req.file.path)
      ) {
        try {
          fs.unlinkSync(
            req.file.path
          );
        } catch (unlinkErr) {
          console.error(
            "Cleanup error:",
            unlinkErr
          );
        }
      }

      res.status(500).json({
        message:
          "Failed to process PDF",
        error:
          error.message
      });
    }
  }
);

router.post(
  "/auto-upload-local",
  authMiddleware,
  async (req, res) => {
    try {
      const {
        domainId,
        fileNameOrPath
      } = req.body;

      if (
        !domainId ||
        !fileNameOrPath
      ) {
        return res.status(400).json({
          message:
            "Domain ID and file name or path are required"
        });
      }

      let domain =
        await Domain.findOne({
          _id: domainId,
          createdBy:
            req.user.userId
        });

      if (!domain) {
        domain =
          await Domain.findOne({
            createdBy:
              req.user.userId
          });
      }

      if (!domain) {
        domain =
          new Domain({
            name:
              "General Documents",
            description:
              "Auto-created domain for uploaded resources",
            createdBy:
              req.user.userId
          });

        await domain.save();
      }

      let cleanInput =
        fileNameOrPath
          .trim()
          .replace(
            /["']/g,
            ""
          );

      cleanInput =
        cleanInput
          .replace(
            /\s+dot\s+/gi,
            "."
          )
          .replace(
            /\s+pdf$/gi,
            ".pdf"
          )
          .replace(
            /\s+txt$/gi,
            ".txt"
          )
          .replace(
            /\s+doc$/gi,
            ".doc"
          )
          .replace(
            /\s+docx$/gi,
            ".docx"
          )
          .replace(
            /\s+md$/gi,
            ".md"
          );

      let resolvedPath =
        null;

      let originalName =
        path.basename(
          cleanInput
        );

      if (
        fs.existsSync(
          cleanInput
        ) &&
        fs.statSync(
          cleanInput
        ).isFile()
      ) {
        resolvedPath =
          path.resolve(
            cleanInput
          );

        originalName =
          path.basename(
            resolvedPath
          );
      } else {
        const homedir =
          require("os")
            .homedir();

        const searchDirs = [
          path.join(
            __dirname,
            "..",
            "uploads"
          ),
          path.join(
            __dirname,
            "..",
            ".."
          ),
          path.join(
            __dirname,
            ".."
          ),
          path.join(
            __dirname,
            "..",
            "..",
            "client"
          ),
          path.join(
            homedir,
            "OneDrive",
            "Documents"
          ),
          path.join(
            homedir,
            "Documents"
          ),
          path.join(
            homedir,
            "Downloads"
          ),
          path.join(
            homedir,
            "Desktop"
          ),
          homedir
        ];

        const baseWithoutExt =
          originalName.replace(
            /\.[^/.]+$/,
            ""
          );

        const possibleNames = [
          originalName,
          originalName.toLowerCase(),
          baseWithoutExt,
          baseWithoutExt.toLowerCase(),
          `${baseWithoutExt}.pdf`,
          `${baseWithoutExt}.txt`,
          `${baseWithoutExt}.md`,
          `${baseWithoutExt}.doc`,
          `${baseWithoutExt}.docx`
        ];

        for (
          const dir of searchDirs
        ) {
          if (
            !fs.existsSync(dir)
          ) {
            continue;
          }

          try {
            const files =
              fs.readdirSync(
                dir
              );

            for (
              const file of files
            ) {
              const fileLower =
                file.toLowerCase();

              for (
                const candidate
                of possibleNames
              ) {
                if (
                  fileLower ===
                  candidate.toLowerCase()
                ) {
                  const fullCandidatePath =
                    path.join(
                      dir,
                      file
                    );

                  if (
                    fs.existsSync(
                      fullCandidatePath
                    ) &&
                    fs.statSync(
                      fullCandidatePath
                    ).isFile()
                  ) {
                    resolvedPath =
                      fullCandidatePath;

                    originalName =
                      file;

                    break;
                  }
                }
              }

              if (
                resolvedPath
              ) {
                break;
              }
            }

            if (
              !resolvedPath
            ) {
              for (
                const file of files
              ) {
                const fileLower =
                  file.toLowerCase();

                if (
                  fileLower.includes(
                    baseWithoutExt.toLowerCase()
                  ) &&
                  (
                    fileLower.endsWith(
                      ".pdf"
                    ) ||
                    fileLower.endsWith(
                      ".txt"
                    ) ||
                    fileLower.endsWith(
                      ".md"
                    )
                  )
                ) {
                  const fullCandidatePath =
                    path.join(
                      dir,
                      file
                    );

                  if (
                    fs.existsSync(
                      fullCandidatePath
                    ) &&
                    fs.statSync(
                      fullCandidatePath
                    ).isFile()
                  ) {
                    resolvedPath =
                      fullCandidatePath;

                    originalName =
                      file;

                    break;
                  }
                }
              }
            }
          } catch {
          }

          if (
            resolvedPath
          ) {
            break;
          }
        }
      }

      if (!resolvedPath) {
        return res.status(404).json({
          notFound: true,
          message:
            `Could not find file "${cleanInput}" in common folders on your computer.`
        });
      }

      const ext =
        path.extname(
          originalName
        ).toLowerCase();

      const sanitized =
        originalName.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

      const uniqueFileName =
        `${Date.now()}-${sanitized}`;

      const destinationPath =
        path.join(
          uploadsDir,
          uniqueFileName
        );

      fs.copyFileSync(
        resolvedPath,
        destinationPath
      );

      let extractedText = "";
      let resourceType = "pdf";

      if (ext === ".pdf") {
        const pdfBuffer =
          fs.readFileSync(
            destinationPath
          );

        const pdfData =
          await pdfParse(
            pdfBuffer,
            {
              pagerender:
                renderPdfPage
            }
          );

        extractedText =
          (pdfData.text || "")
            .trim();

        if (!extractedText) {
          extractedText =
            `PDF document: ${originalName}`;
        }
      } else {
        resourceType =
          "text";

        extractedText =
          fs.readFileSync(
            destinationPath,
            "utf-8"
          ).trim();
      }

      const fileUrl =
        `/uploads/${uniqueFileName}`;

      if (
        resourceType === "pdf"
      ) {
        const rawPages = extractedText
          .split(/---PAGE_(\d+)---/)
          .filter(Boolean);

        const pages = [];

        for (
          let i = 0;
          i < rawPages.length;
          i += 2
        ) {
          if (
            rawPages[i + 1]
          ) {
            pages.push({
              pageNumber:
                Number(rawPages[i]),
              text:
                rawPages[i + 1].trim()
            });
          }
        }

        const sectionChunks =
          buildSectionChunks(pages);

        if (
          sectionChunks.length > 0
        ) {
          const savedResources = [];

          for (
            const section of sectionChunks
          ) {
            const content =
              cleanPdfText(
                section.text
              ).slice(0, 6000);

            const chunkTitle =
              `${originalName} [Section ${section.sectionNumber}: ${section.heading}]`;

            const textToEmbed =
              `${originalName}. ` +
              `Section ${section.sectionNumber}. ` +
              `${section.heading}. ` +
              `${content}`;

            const embedding =
              await generateEmbedding(
                textToEmbed
              );

            const resource =
              new Resource({
                domainId,
                type: "pdf",
                title:
                  chunkTitle,
                content,
                fileName:
                  originalName,
                filePath:
                  savedResources.length === 0
                    ? destinationPath
                    : "",
                fileUrl,
                embedding
              });

            await resource.save();

            savedResources.push(
              resource
            );
          }

          return res.status(201).json({
            message:
              `File "${originalName}" uploaded and split into ${savedResources.length} section-based resources!`,
            resource:
              savedResources[0],
            totalChunks:
              savedResources.length,
            chunkingMethod:
              "section-based"
          });
        }

        const chunks =
          chunkText(
            extractedText,
            {
              maxWords: 400,
              overlapWords: 80
            }
          );

        if (
          chunks.length > 1
        ) {
          const savedResources =
            [];

          for (
            let i = 0;
            i < chunks.length;
            i++
          ) {
            const chunkContent =
              chunks[i];

            const chunkTitle =
              `${originalName} [Part ${i + 1}/${chunks.length}]`;

            const textToEmbed =
              `${originalName}. ` +
              `${chunkContent}`;

            const embedding =
              await generateEmbedding(
                textToEmbed
              );

            const resource =
              new Resource({
                domainId,
                type:
                  resourceType,
                title:
                  chunkTitle,
                content:
                  chunkContent,
                fileName:
                  originalName,
                filePath:
                  i === 0
                    ? destinationPath
                    : "",
                fileUrl,
                embedding
              });

            await resource.save();

            savedResources.push(
              resource
            );
          }

          return res.status(201).json({
            message:
              `File "${originalName}" uploaded, chunked into ${chunks.length} parts, and embedded!`,
            resource:
              savedResources[0],
            totalChunks:
              savedResources.length
          });
        }
      }

      const textToEmbed =
        `${originalName}. ` +
        extractedText.slice(
          0,
          4000
        );

      const embedding =
        await generateEmbedding(
          textToEmbed
        );

      const resource =
        new Resource({
          domainId,
          type:
            resourceType,
          title:
            originalName,
          content:
            extractedText,
          fileName:
            originalName,
          filePath:
            destinationPath,
          fileUrl,
          embedding
        });

      await resource.save();

      res.status(201).json({
        message:
          `File "${originalName}" uploaded from computer filesystem and embedded successfully!`,
        resource
      });
    } catch (error) {
      console.error(
        "Auto upload local file error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to upload local file",
        error:
          error.message
      });
    }
  }
);

router.post(
  "/:domainId",
  authMiddleware,
  async (req, res) => {
    try {
      const {
        type,
        title,
        content
      } = req.body;

      if (
        !type ||
        !title ||
        !title.trim()
      ) {
        return res.status(400).json({
          message:
            "Type and title are required"
        });
      }

      const domain =
        await Domain.findOne({
          _id:
            req.params.domainId,
          createdBy:
            req.user.userId
        });

      if (!domain) {
        return res.status(404).json({
          message:
            "Domain not found"
        });
      }

      const cleanTitle =
        title.trim();

      const cleanContent =
        (content || "").trim();

      const textToEmbed =
        `${cleanTitle}. ` +
        cleanContent.slice(
          0,
          4000
        );

      const embedding =
        await generateEmbedding(
          textToEmbed
        );

      const resource =
        new Resource({
          domainId:
            req.params.domainId,
          type,
          title:
            cleanTitle,
          content:
            cleanContent,
          embedding
        });

      await resource.save();

      res.status(201).json({
        message:
          "Resource added successfully",
        resource
      });
    } catch (error) {
      console.error(
        "Resource embedding error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to add resource",
        error:
          error.message
      });
    }
  }
);

router.put(
  "/:domainId/:resourceId",
  authMiddleware,
  async (req, res) => {
    try {
      const {
        title,
        content
      } = req.body;

      if (
        !title ||
        !title.trim()
      ) {
        return res.status(400).json({
          message:
            "Title is required"
        });
      }

      const domain =
        await Domain.findOne({
          _id:
            req.params.domainId,
          createdBy:
            req.user.userId
        });

      if (!domain) {
        return res.status(404).json({
          message:
            "Domain not found"
        });
      }

      const resource =
        await Resource.findOne({
          _id:
            req.params.resourceId,
          domainId:
            req.params.domainId
        });

      if (!resource) {
        return res.status(404).json({
          message:
            "Resource not found"
        });
      }

      const cleanTitle =
        title.trim();

      const cleanContent =
        content !== undefined
          ? content.trim()
          : resource.content;

      const textToEmbed =
        `${cleanTitle}. ` +
        cleanContent.slice(
          0,
          4000
        );

      const embedding =
        await generateEmbedding(
          textToEmbed
        );

      resource.title =
        cleanTitle;

      resource.content =
        cleanContent;

      resource.embedding =
        embedding;

      await resource.save();

      res.json({
        message:
          "Resource updated successfully",
        resource
      });
    } catch (error) {
      console.error(
        "Resource update error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to update resource",
        error:
          error.message
      });
    }
  }
);

router.delete(
  "/:domainId/:resourceId",
  authMiddleware,
  async (req, res) => {
    try {
      const domain =
        await Domain.findOne({
          _id:
            req.params.domainId,
          createdBy:
            req.user.userId
        });

      if (!domain) {
        return res.status(404).json({
          message:
            "Domain not found"
        });
      }

      const resource =
        await Resource.findOne({
          _id:
            req.params.resourceId,
          domainId:
            req.params.domainId
        });

      if (!resource) {
        return res.status(404).json({
          message:
            "Resource not found"
        });
      }

      if (
        resource.filePath &&
        fs.existsSync(
          resource.filePath
        )
      ) {
        try {
          fs.unlinkSync(
            resource.filePath
          );
        } catch (fileErr) {
          console.error(
            "Error removing file:",
            fileErr
          );
        }
      }

      if (
        resource.type === "pdf" &&
        resource.fileName
      ) {
        await Resource.deleteMany({
          domainId:
            req.params.domainId,
          fileName:
            resource.fileName,
          type: "pdf"
        });
      } else {
        await Resource.deleteOne({
          _id:
            resource._id
        });
      }

      res.json({
        message:
          "Resource deleted successfully"
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Failed to delete resource",
        error:
          error.message
      });
    }
  }
);



module.exports = router;
