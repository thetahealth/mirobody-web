import { lazy, useEffect, useState } from "react";
import { Navigate } from "react-router";
import api from "../api";

const Indicators = lazy(() => import("../pages/Indicators/index.jsx"));

// The count sits in front of the first screen, so it gets a deadline. It is a
// COUNT over v_observation, which is fast for most people and not for someone
// with years of device samples; past this, land on 指标 as if it had failed.
const LANDING_TIMEOUT_MS = 3000;

/**
 * `/` — 指标 for anyone who has data, 数据 for someone who has none.
 *
 * With nothing in the record, 指标 is an empty page that sends you somewhere
 * else; 数据 is where that somewhere is, and it greets an empty record with
 * the ways to fill it. Only `/` splits: the sidebar's 指标 and a typed
 * /indicators still go straight to 指标.
 *
 * The count is the signed-in person's own (no `user_id`), not the shared
 * distribution store's: that store follows the person switcher, so after
 * switching to a family member it holds THEIR count, and landing is about you.
 *
 * Anything short of a clean zero — an error, a timeout, a missing field —
 * lands on 指标, which is where `/` went before this existed. Nothing renders
 * while the answer is out, so 指标 never flashes on its way to 数据.
 */
const Landing = () => {
  const [target, setTarget] = useState(null); // null | "indicators" | "data"

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LANDING_TIMEOUT_MS);
    api
      .dataDistribution({}, controller.signal)
      .then((data) => {
        if (!cancelled) {
          setTarget(data?.total_records === 0 ? "data" : "indicators");
        }
      })
      .catch(() => {
        if (!cancelled) setTarget("indicators");
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  if (target === "data") return <Navigate to="/data" replace />;
  if (target === "indicators") return <Indicators />;
  return null;
};

export default Landing;
