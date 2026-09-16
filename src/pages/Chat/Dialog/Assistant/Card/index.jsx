import { CHART_MESSAGE_TYPE } from "../../../../../enum/chat";
import styles from "./index.module.scss";
import CopySVG from "../../../../../assets/chat-copy.svg?react";
import FullSVG from "../../../../../assets/chat-full.svg?react";
import CollapseSVG from "../../../../../assets/chat-collapse.svg?react";
import { useRef } from "react";
import CostIcon from "../CostIcon";

function AssistantCard({
  datasource,
  children,
  isShowFullpage,
  fullpageDatasource,
  onToggleFullpage,
  modelShowName = "",
}) {
  const contentRef = useRef(null);

  // click copy to clipboard
  const onClickCopy = (datasource) => {
    const content = datasource?.messages
      .filter((msg) => msg.type === CHART_MESSAGE_TYPE.TEXT)
      .map((msg) => msg.text)
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(content);
  };

  // Auto-scroll to bottom when content changes
  // useEffect(() => {
  //   if (contentRef.current) {
  //     contentRef.current.scrollTop = contentRef.current.scrollHeight;
  //   }
  // }, [children, datasource?.content]);

  // Find cost statistics message from datasource
  const usage = datasource?.messages?.find(
    (msg) => msg.type === CHART_MESSAGE_TYPE.USAGE,
  );

  // Check if this specific card is in fullpage mode
  const isThisCardFullpage =
    isShowFullpage && fullpageDatasource?.id === datasource?.id;

  // click fullpage - handle toggle logic internally
  const onClickFullpage = () => {
    if (onToggleFullpage) {
      if (isThisCardFullpage) {
        // If currently fullpage, close it
        onToggleFullpage(null);
      } else {
        // If not fullpage, open it
        onToggleFullpage(datasource);
      }
    }
  };
  return (
    <div
      className={`${styles.card} ${isThisCardFullpage ? styles.fullpage : ""}`}
    >
      <div className={styles.header}>
        <div className={styles.header_left}>
          {modelShowName ? `${modelShowName}` : ""}
          {/* <Stars rating={datasource?.rating || 0} onClick={onClickRatingStar} /> */}
        </div>
        <div className={styles.btns}>
          {usage && <CostIcon datasource={usage} />}
          <div className={styles.copy_btn}>
            <CopySVG onClick={() => onClickCopy(datasource)} />
          </div>
          <div className={styles.copy_btn} onClick={onClickFullpage}>
            {isThisCardFullpage ? <CollapseSVG /> : <FullSVG />}
          </div>
        </div>
      </div>
      <div className={styles.content} ref={contentRef}>
        {children}
      </div>
    </div>
  );
}

export default AssistantCard;
