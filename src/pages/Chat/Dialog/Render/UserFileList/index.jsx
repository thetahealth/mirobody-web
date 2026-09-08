import { FILE_TYPE } from "../../../../../enum/file";
import FileItem from "../../../../../components/FileItem";
import ProtectedImage from "../../../../../components/ProtectedImage";
// import { useChatPreviewStore } from "../../../../../store/Chart/preview";

const UserFileList = ({ datasource }) => {
  // const setPreviewFile = useChatPreviewStore((state) => state.setPreviewFile);
  // const setIsShowPreview = useChatPreviewStore(
  //   (state) => state.setIsShowPreview,
  // );
  // preview image or file
  const handleClickPreview = (_datasource) => {
    /* TODO: preview image or file
    const { url_thumb, filename, file_size, type } = datasource;
    setPreviewFile({ url: url_thumb, type, filename, size: file_size });
    setIsShowPreview(true);
    */
  };
  if (!datasource || !datasource.content || datasource.content.length === 0) {
    return null;
  }
  return (
    <div className="flex items-center overflow-x-auto gap-[12px]">
      {datasource.content.map((item) => {
        if (item.file_type === FILE_TYPE.IMAGE) {
          return (
            <ProtectedImage
              key={item.file_key}
              src={item.file_url}
              alt="image"
              className="w-[68px] h-[68px] rounded-[12px] object-cover cursor-pointer border border-[var(--color-border)] hover:border-[var(--color-accent)]"
              onClick={() => handleClickPreview(item)}
            />
          );
        }

        return (
          <FileItem
            key={item.file_key}
            datasource={item}
            is_show_delete={false}
            className="w-[240px] h-[68px] rounded-[12px] p-[0_16px] border border-[var(--color-accent)] bg-[#fff] cursor-pointer"
            onClick={() => handleClickPreview(item)}
          />
        );
      })}
    </div>
  );
};

export default UserFileList;
