import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import api from "../../api";
import { FILE_STATUS, MAX_FILE_COUNT } from "../../enum/file";
import { v4 as uuidv4 } from "uuid";
import { validateFilesPromiseConfirm } from "../../utils/file";
import Modal from "../../components/Modal";
import { t } from "i18next";
import consola from "consola";
/**
 * file list
 * file_list: [
 *  {
 *    file_key: "",
 *    file_type: "",
 *    file_name: "",
 *    file_url: "",
 *    file_size: "",
 *    progress: 0,
 *    status: "pending",
 *  },
 * ]
 */

export const useChartInputStore = create(
  immer((set, get) => ({
    // question
    question: "",
    setQuestion: (question) => set({ question }),
    clearQuestion: () => set({ question: "" }),
    // file list
    file_list: [],
    /**
     * add file to file list
     * @param {Object[]} files [{file_key: string, file_type: string, file_name: string, file_url: string, file_size: number}]
     * @returns {void}
     */
    addFilesToFileList: (files) =>
      set((state) => {
        state.file_list.push(...files);
      }),
    removeFile: (file) =>
      set((state) => {
        const index = state.file_list.findIndex(
          (f) => f.file_key === file.file_key,
        );
        if (index !== -1) {
          state.file_list.splice(index, 1);
        }
      }),
    clearFileList: () => set({ file_list: [] }),
    /**
     * upload files to server with progress
     * @param {File[]} files
     * @returns {void}
     */
    startUploadFilesToServer: async (files) => {
      try {
        if (files.length === 0) {
          return;
        }
        if (
          files.length > MAX_FILE_COUNT ||
          files.length + get().file_list.length > MAX_FILE_COUNT
        ) {
          Modal.confirm({
            title: t("file_count_too_many"),
            content: t("file_count_too_many_desc", { count: MAX_FILE_COUNT }),
            isShowCancelButton: false,
          });
          return;
        }
        // verify files
        await validateFilesPromiseConfirm(files);
        // add files to file list
        const { addFilesToFileList } = get();
        const _new_files = files.map((f) => ({
          ...f,
          status: FILE_STATUS.PENDING,
          progress: 0,
          file_key: uuidv4(),
        }));
        addFilesToFileList(_new_files);

        for (let index = 0; index < _new_files.length; index++) {
          const file = _new_files[index];
          api
            .uploadSingleFileWithProgress(file.file, ({ percentage }) => {
              set((state) => {
                const targetFile = state.file_list.find(
                  (f) => f.file_key === file.file_key,
                );
                if (targetFile) {
                  targetFile.progress = percentage;
                  targetFile.status = FILE_STATUS.UPLOADING;
                }
              });
            })
            .then((res) => {
              if (!res[0] || !res[0].file_key) {
                throw new Error("upload file to server failed");
              }
              const { file_key, file_url, file_size, file_name, file_type } =
                res[0];
              set((state) => {
                const targetFile = state.file_list.find(
                  (f) => f.file_key === file.file_key,
                );
                if (targetFile) {
                  targetFile.status = FILE_STATUS.SUCCESS;
                  targetFile.progress = 100;
                  targetFile.file_key = file_key;
                  targetFile.file_url = file_url;
                  targetFile.file_size = file_size;
                  targetFile.file_name = file_name;
                  targetFile.original_file_type = file_type;
                }
              });
            })
            .catch((error) => {
              consola.error("ERROR: uploadSingleFileWithServer", error);
              set((state) => {
                const targetFile = state.file_list.find(
                  (f) => f.file_key === file.file_key,
                );
                if (targetFile) {
                  targetFile.status = FILE_STATUS.ERROR;
                  targetFile.progress = 0;
                }
              });
            });
        }
      } catch (error) {
        consola.error("ERROR: startUploadFilesToServer", error);
      }
    },
  })),
);
