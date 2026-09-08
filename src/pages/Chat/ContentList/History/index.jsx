import { useChatStore } from "../../../../store/Chart/index";
import { useChartDataStore } from "../../../../store/Chart/data";
import RenderHistoryList from "./RenderHistoryList";

function HistoryList() {
  const current_session_id = useChatStore((state) => state.current_session_id);
  const history_list = useChartDataStore(
    (state) => state.chartData[current_session_id]?.history,
  );
  const isShowFullpage = useChatStore((state) => state.is_show_fullpage);
  const fullpageDatasource = useChatStore((state) => state.fullpage_datasource);
  const switchIsShowFullpage = useChatStore(
    (state) => state.switchIsShowFullpage,
  );
  const setFullpageDatasource = useChatStore(
    (state) => state.setFullpageDatasource,
  );

  const handleToggleFullpage = (datasource) => {
    if (datasource) {
      setFullpageDatasource(datasource);
    } else {
      setFullpageDatasource(null);
    }
    switchIsShowFullpage();
  };

  return (
    <RenderHistoryList
      history_list={history_list}
      assistantDialogProps={{
        isShowFullpage,
        fullpageDatasource,
        onToggleFullpage: handleToggleFullpage,
      }}
    />
  );
}

export default HistoryList;
