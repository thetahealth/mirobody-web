import styles from "./index.module.scss";
import ContentRender from "../Render";
import RenderErrorBoundary from "../Render/ErrorBoundary";

function UserDialog({ datasource }) {
  return (
    <div className={styles.wrapper} data-role="user">
      {datasource.map((item) => (
        <RenderErrorBoundary key={item.id}>
          <ContentRender datasource={item} />
        </RenderErrorBoundary>
      ))}
    </div>
  );
}

export default UserDialog;
