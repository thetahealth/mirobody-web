import { lazy, useEffect, useState } from "react";
import { Navigate } from "react-router";
import api from "../api";

const Indicators = lazy(() => import("../pages/Indicators/index.jsx"));

// The lookup sits in front of the first screen, so it gets a deadline. It is
// the 指标 page's own catalog query, which is fast for most people and not for
// someone with years of device samples; past this, land on 指标 as if it had
// failed.
const LANDING_TIMEOUT_MS = 3000;

/**
 * `/` — 指标 for anyone who has readings to look at, 数据 for someone who has
 * none.
 *
 * With no readings, 指标 is an empty page that sends you somewhere else; 数据
 * is where that somewhere is, and it greets an empty record with the ways to
 * fill it. Only `/` splits: the sidebar's 指标 and a typed /indicators still go
 * straight to 指标.
 *
 * The question is "does 指标 have anything to show", so it asks 指标's own
 * catalog — not the record's size. The two differ: a logged complaint or a
 * genotype counts toward `data-distribution`'s total but is not a row in the
 * catalog, and a person with only those would land on 指标's empty state.
 *
 * It is the signed-in person's own catalog (no `target_user_id`), whoever the
 * person switcher last pointed at: landing is about you.
 *
 * Anything short of a clean empty catalog — an error, a timeout, a shape it
 * does not recognise — lands on 指标, which is where `/` went before this
 * existed. Nothing renders while the answer is out, so 指标 never flashes on
 * its way to 数据.
 */
const Landing = () => {
  const [target, setTarget] = useState(null); // null | "indicators" | "data"

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LANDING_TIMEOUT_MS);
    api
      .getIndicatorCatalog({ signal: controller.signal })
      .then((res) => {
        if (cancelled) return;
        const empty = Array.isArray(res?.rows) && res.rows.length === 0 && !res.total;
        setTarget(empty ? "data" : "indicators");
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
