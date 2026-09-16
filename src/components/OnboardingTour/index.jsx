import { useEffect } from "react";
import { Tour } from "antd";
import { useTranslation } from "react-i18next";
import { useAccountStore } from "../../store/account";
import { hasSeenTour, markTourSeen, useTourStore } from "../../store/tour";

/**
 * The sidebar walkthrough. Plays itself once after the first sign-in, and can
 * be reopened from the account menu ("重新查看引导").
 *
 * Mounted once in ProtectedLayout so it is available on every signed-in page,
 * and so the sidebar it points at is guaranteed to be on screen.
 */
const OnboardingTour = () => {
  const { t } = useTranslation();
  const user_id = useAccountStore((s) => s.user_id);
  const open = useTourStore((s) => s.open);
  const steps = useTourStore((s) => s.steps);
  const start = useTourStore((s) => s.start);
  const close = useTourStore((s) => s.close);

  useEffect(() => {
    if (open) return; // already playing, or just reopened by hand
    if (!user_id) return; // don't know who this is yet
    if (hasSeenTour(user_id)) return;
    // One frame's grace so the sidebar has mounted — start() resolves every
    // anchor against the DOM as it is at that moment.
    const id = requestAnimationFrame(() => start());
    return () => cancelAnimationFrame(id);
  }, [open, user_id, start]);

  // Built on each render on purpose: antd calls the target resolver when it
  // shows a step, so it always gets the element that is on screen now, and the
  // copy re-reads from i18n if the language changes mid-tour.
  const antdSteps = steps.map((s) => ({
    title: t(`tour_${s.key}_title`),
    description: t(`tour_${s.key}_desc`),
    target: s.anchor
      ? () => document.querySelector(`[data-tour="${s.anchor}"]`)
      : undefined,
    placement: s.anchor ? "right" : "center",
  }));

  // Closing counts as done whether it was finished or skipped: the tour is not
  // a required flow, and re-showing something the reader dismissed is nagging.
  // The account menu is there for anyone who wants it back.
  const handleClose = () => {
    markTourSeen(user_id);
    close();
  };

  if (!open || antdSteps.length === 0) return null;

  return (
    <Tour
      open
      steps={antdSteps}
      onClose={handleClose}
      onFinish={handleClose}
      indicatorsRender={(current, total) => (
        <span>{`${current + 1} / ${total}`}</span>
      )}
    />
  );
};

export default OnboardingTour;
