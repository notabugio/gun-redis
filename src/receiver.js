import * as R from "ramda";
import { createClient } from "./client";

export const respondToGets = (Gun, { skipValidation = true } = {}) => db => {
  const redis = (Gun.redis = Gun.redis || createClient(Gun));

  db.onIn(msg => {
    const { from, json, fromCluster } = msg;
    const soul = R.path(["get", "#"], json);
    const dedupId = R.prop("#", json);

    if (!soul || fromCluster) return msg;
    return redis
      .batchedGet(soul, result => {
        const json = {
          "#": from.msgId(),
          "@": dedupId,
          put: result ? { [soul]: result } : null
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

export const acceptWrites = Gun => db => {
  const redis = (Gun.redis = Gun.redis || createClient(Gun)); // eslint-disable-line

  db.onIn(msg => {
    if (msg.fromCluster) return msg;
    if (msg.json.put) {
      return db
        .getDiff(msg.json.put)
        .then(diff => {
          const souls = R.keys(diff);

          if (!souls.length) return msg;
          // return console.log("would write", diff) || msg;
          return redis
            .write(diff)
            .then(() => console.log("wrote", diff) || msg);
        })
        .catch(err =>
          console.error("error accepting writes", err.stack || err)
        );
    }
    return msg;
  });

  return db;
};
