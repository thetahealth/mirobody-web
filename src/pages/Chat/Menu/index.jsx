import { useChatMenuStore } from "../../../store/Chart/menu";
import ChatHistorySVG from "../../../assets/chat-history.svg?react";
import ChatNewBlueSVG from "../../../assets/chat-new-blue.svg?react";
import MenuComponent from "../../../components/Menu";
import { useChatStore } from "../../../store/Chart";
import HistoryList from "./HistoryList";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useUiStore } from "../../../store/ui";
import useIsMobile from "../../../hooks/useIsMobile";

function Menu() {
  const isExpanded = useChatMenuStore((state) => state.is_menu_open);
  const switchChatMenu = useChatMenuStore((state) => state.switchChatMenu);
  const startNewChat = useChatStore((state) => state.startNewChat);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Inside the mobile drawer there's no collapsed rail — always show the list.
  const expanded = isMobile || isExpanded;

  const handleNewChat = () => {
    startNewChat();
    navigate("/ask");
    useUiStore.getState().setSidebarDrawerOpen(false);
  };

  return (
    <MenuComponent minWidth={88} maxWidth={300} isExpanded={isExpanded}>
      {/* Mirrors the Drive sidebar exactly — same insets (24px), same action
          row (8px padding, 8px radius, border-color hover), same list divider —
          so the two pages read as one component. Collapse toggle is
          desktop-only; the drawer is already the open panel. */}
      {!isMobile && (
        <button
          type="button"
          className="flex items-center mx-[24px] px-[8px] py-[8px] rounded-[8px] bg-transparent border-0 cursor-pointer hover:bg-[var(--color-border)] text-left"
          onClick={switchChatMenu}
          aria-label={t("chat_history")}
        >
          {/* shrink-0: on the 88px collapsed rail the flex row is narrower
              than the 40px glyph, and without it the svg gets squeezed. */}
          <ChatHistorySVG className="shrink-0" />
          {/* Same row anatomy as "new conversation" below (24px margin + 8px
              padding), so the two icons sit on one vertical line — and a
              label, because a bare glyph made users guess what it toggles. */}
          {expanded && (
            <div className="whitespace-nowrap overflow-hidden text-ellipsis flex-1 ml-[4px] font-[500] text-[var(--color-text-primary)]">
              {t("chat_history")}
            </div>
          )}
        </button>
      )}
      {/* New conversation lives in the ChatHeader (＋) on mobile. On desktop
          it stays visible on the COLLAPSED rail too — icon only — so the
          primary action never disappears with the panel. */}
      {!isMobile && (
        <button
          type="button"
          className="flex items-center mx-[24px] mt-[20px] px-[8px] py-[8px] rounded-[8px] bg-transparent border-0 cursor-pointer hover:bg-[var(--color-border)] text-left"
          onClick={handleNewChat}
          aria-label={t("new_conversation")}
        >
          <ChatNewBlueSVG className="shrink-0" />
          {expanded && (
            <div className="whitespace-nowrap overflow-hidden text-ellipsis flex-1 ml-[4px] text-[var(--color-accent)] font-[500]">
              {t("new_conversation")}
            </div>
          )}
        </button>
      )}
      <div
        className={`transition-opacity ${
          expanded
            ? "duration-300 opacity-100"
            : "duration-0 opacity-0 pointer-events-none"
        } delay-300 flex-1 w-full overflow-hidden flex flex-col`}
      >
        {expanded && <HistoryList />}
      </div>
    </MenuComponent>
  );
}

export default Menu;
