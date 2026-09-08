// import { useState } from "react";
import FileItem from "../../../../components/FileItem";
import { useChartInputStore } from "../../../../store/Chart/input";

function FileList() {
  const file_list = useChartInputStore((state) => state.file_list);
  const removeFile = useChartInputStore((state) => state.removeFile);
  const handleDeleteFile = (file) => {
    removeFile(file);
  };
  if (file_list.length === 0) {
    return null;
  }
  return (
    <div className="flex w-full overflow-x-auto gap-[12px] user-select-none mb-[12px]">
      {file_list.map((file) => (
        <FileItem
          key={file.file_key}
          datasource={file}
          is_show_delete={true}
          onClickDelete={handleDeleteFile}
        />
      ))}
    </div>
  );
}

export default FileList;
