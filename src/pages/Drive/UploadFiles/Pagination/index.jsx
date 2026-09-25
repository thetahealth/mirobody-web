import { useState, useEffect, useRef } from "react";
import styles from "./index.module.scss";
import { useUploadStore } from "../../../../store/upload";
import { useTranslation } from "react-i18next";
import { IconChevronDown } from "@tabler/icons-react";

const generatePageNumbers = (currentPage, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
};

const Pagination = () => {
  const { t } = useTranslation();
  const total = useUploadStore((state) => state.total);
  const currentPage = useUploadStore((state) => state.currentPage);
  const pageSize = useUploadStore((state) => state.pageSize);
  const setPage = useUploadStore((state) => state.setPage);
  const nextPage = useUploadStore((state) => state.nextPage);
  const prevPage = useUploadStore((state) => state.prevPage);

  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const totalPages = Math.ceil(total / pageSize);
  const pages = generatePageNumbers(currentPage, totalPages);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  if (total === 0) {
    return null;
  }

  const handlePageClick = (page) => {
    if (page !== "..." && page !== currentPage) {
      setPage(page);
    }
  };

  const handleDropdownSelect = (page) => {
    setPage(page);
    setShowDropdown(false);
  };

  return (
    <div className={styles.paginationContainer}>
      <div className={styles.pageButtons}>
        <button
          className={styles.navButton}
          onClick={prevPage}
          disabled={currentPage === 1}
        >
          <span className={styles.arrow}>←</span>
          <span>{t("previous")}</span>
        </button>
        {pages.map((page, index) => (
          <button
            key={index}
            className={`${styles.pageButton} ${
              page === currentPage ? styles.pageButtonActive : ""
            } ${page === "..." ? styles.pageButtonEllipsis : ""}`}
            onClick={() => handlePageClick(page)}
            disabled={page === "..." || totalPages === 1}
          >
            {page}
          </button>
        ))}
        <button
          className={styles.navButtonNext}
          onClick={nextPage}
          disabled={currentPage === totalPages}
        >
          <span>{t("next")}</span>
          <span className={styles.arrow}>→</span>
        </button>
      </div>

      <div className={styles.pageSelector}>
        <span className={styles.pageSelectorText}>{t("page")}</span>
        <div className={styles.dropdownContainer} ref={dropdownRef}>
          <div
            className={styles.dropdown}
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <span>{currentPage}</span>
            <IconChevronDown
              size={16}
              stroke={1.8}
              className="text-[var(--color-text-secondary)]"
              aria-hidden="true"
            />
          </div>
          {showDropdown && (
            <div className={styles.dropdownMenu}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <div
                    key={page}
                    className={`${styles.dropdownItem} ${
                      page === currentPage ? styles.dropdownItemActive : ""
                    }`}
                    onClick={() => handleDropdownSelect(page)}
                  >
                    {page}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
        <span className={styles.pageSelectorText}>{t("of")}</span>
        <span className={styles.pageSelectorText}>{totalPages}</span>
      </div>
    </div>
  );
};

export default Pagination;
