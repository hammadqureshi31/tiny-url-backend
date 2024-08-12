import { URL } from "../model/urlModel.js";
import qrcode from "qrcode";
import shortid from "shortid";

export async function handleFindAllURLs(req, res) {
  try {
    const allURLs = await URL.find({});
    if (allURLs.length === 0) {
      return res.status(404).send("NO URL Found");
    }

    return res.send(allURLs);
  } catch (error) {
    return res.status(500).send("Error fetching URLs: " + error.message);
  }
}

export async function handleCreateNewShortID(req, res) {
  const { url } = req.body;
  // console.log("url received on backend testing ", url);
  // console.log("user received on backend testing ", req.user._id);
  if (!url) return res.status(404).send("URL required");

  try {
    const shortId = shortid.generate();
    const qrCodeURL = await qrcode.toDataURL(url);

    const newURL = {
      shortID: shortId,
      redirectURL: url,
      qrcode: qrCodeURL,
      visitHistory: [],
      createdBy: req.user._id
    };

    const result = await URL.create(newURL);
    return res.status(200).json({ id: shortId, qrcode: qrCodeURL });
  } catch (error) {
    return res.status(500).send("Error creating URL: " + error.message);
  }
}

export async function handleFindByShortId(req, res) {
  const { shortID } = req.params;
  console.log("ShortId", shortID);
  const result = await URL.findOneAndUpdate({ shortID },{
      $push: {
        visitHistory: {
          timestamp: Date.now(),
        },
      },
    }
  );
  // console.log("history", result.visitHistory.length)
  res.redirect(result?.redirectURL);
}
