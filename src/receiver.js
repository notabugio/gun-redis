import { path, prop } from "ramda";
import { createClient } from "./client";

export const respondToGets = (Gun, { skipValidation = true } = {}) => db => {
  const redis = createClient(Gun);

  db.onIn(msg => {
    const { from, json } = msg;
    const soul = path(["get", "#"], json);
    const dedupId = prop("#", json);

    if (!soul) return msg;
    return redis
      .batchedGet(soul, result => {
        const json = {
          "#": from.msgId(),
          "@": dedupId,
          put: { [soul]: result || null }
        };

        from.send({
          json,
          ignoreLeeching: true,
          skipValidation: !result || skipValidation
        });
      })
      .catch(err => {
        const json = {
          "#": from.msgId(),
          "@": dedupId,
          err: `${err}`
        };

        from.send({ json, ignoreLeeching: true, skipValidation });
      })
      .then(() => msg);
  });

  return db;
};
