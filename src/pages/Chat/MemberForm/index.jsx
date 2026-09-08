import styles from "./index.module.scss";
import FormItemInput from "../../../components/Form/FormItem/Input";
import FormItemDate from "../../../components/Form/FormItem/Date";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import dayjs from "dayjs";
import FormItemSelect from "../../../components/Form/FormItem/Select";
import { BLOOD_TYPE_OPTIONS, GENDER_OPTIONS } from "../../../enum/form";
import { useAccountStore } from "../../../store/account";
import api from "../../../api";
import { v4 as uuidv4 } from "uuid";
import { message } from "antd";
import consola from "consola";

function MemberForm({ onClose }) {
  const { t } = useTranslation();
  const fetchBeneficiaryUsers = useAccountStore(
    (state) => state.fetchBeneficiaryUsers,
  );
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    relationship: "",
    dateOfBirth: "",
    gender: "",
    blood: "",
  });

  const [errors, setErrors] = useState({
    firstName: false,
    lastName: false,
    relationship: false,
  });

  const [loading, setLoading] = useState(false);

  // Generic handler for form field changes
  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: false,
      }));
    }
  };

  // Validate required fields
  const validateForm = () => {
    const newErrors = {
      firstName: !formData.firstName.trim(),
      lastName: !formData.lastName.trim(),
      relationship: !formData.relationship.trim(),
    };

    setErrors(newErrors);

    // Return true if no errors
    return !Object.values(newErrors).some((error) => error);
  };

  const onChangeFirstName = (e) => {
    handleFieldChange("firstName", e.target.value);
  };

  const onChangeLastName = (e) => {
    handleFieldChange("lastName", e.target.value);
  };

  const onChangeRelationship = (e) => {
    if (e.target.value.length > 20) {
      return;
    }
    handleFieldChange("relationship", e.target.value);
  };

  const onChangeDateOfBirth = (value) => {
    handleFieldChange("dateOfBirth", dayjs(value).format("MM/DD/YYYY"));
  };

  const onChangeGender = (option) => {
    handleFieldChange("gender", option.value);
  };

  // Translate gender options dynamically
  const translatedGenderOptions = GENDER_OPTIONS.map((option) => ({
    ...option,
    label: t(option.label),
  }));
  const onChangeblood = (option) => {
    handleFieldChange("blood", option.value);
  };
  // cancel
  const onClickCancel = () => {
    clearForm();
    onClose();
  };
  // submit
  const onClickSubmit = async () => {
    try {
      if (loading) return;
      setLoading(true);
      if (validateForm()) {
        const name = `${formData.firstName} ${formData.lastName}`.trim();
        // Backend requires a unique email; virtual members never log in, so a
        // synthetic unique address is fine.
        const email = `member_${uuidv4().replace(/-/g, "")}@virtual.mirobody.ai`;
        const birth = formData.dateOfBirth
          ? dayjs(formData.dateOfBirth, "MM/DD/YYYY").format("YYYY-MM-DD")
          : "";
        await api.createVirtualUser({
          name,
          email,
          gender: formData.gender || "other", // backend maps the string
          birth,
          blood: formData.blood || "",
        });
        message.success(t("add_member_success", "Member added"));
        clearForm();
        onClose();
        fetchBeneficiaryUsers();
      }
    } catch (error) {
      consola.error("ERROR:: onClickSubmit", error);
      message.error(t("add_member_failed", "Failed to add member"));
    } finally {
      setLoading(false);
    }
  };

  // Clear form - reset to initial state
  const clearForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      relationship: "",
      dateOfBirth: "",
      gender: "",
      blood: "",
    });
    setErrors({
      firstName: false,
      lastName: false,
      relationship: false,
    });
  };

  return (
    <div className={styles.member_form} onClick={(e) => e.stopPropagation()}>
      <div className={styles.header}>
        <div className={styles.title}>{t("add_member")}</div>
        <div className={styles.desc}>{t("add_member_desc")}</div>
      </div>
      <div className={styles.content}>
        <FormItemInput
          label={t("first_name")}
          required
          onChange={onChangeFirstName}
          value={formData.firstName}
          error={errors.firstName}
          errorMessage={t("form_error_required")}
        />
        <FormItemInput
          label={t("last_name")}
          required
          onChange={onChangeLastName}
          value={formData.lastName}
          error={errors.lastName}
          errorMessage={t("form_error_required")}
        />
        <FormItemInput
          label={t("relationship")}
          required
          placeholder={t("relationship_placeholder")}
          onChange={onChangeRelationship}
          value={formData.relationship}
          showCounter
          maxLength={20}
          error={errors.relationship}
          errorMessage={t("form_error_required")}
        />
        <FormItemDate
          label={t("date_of_birth")}
          onChange={onChangeDateOfBirth}
          value={formData.dateOfBirth}
        />
        <FormItemSelect
          label={t("gender")}
          onChange={onChangeGender}
          value={formData.gender}
          options={translatedGenderOptions}
        />
        <FormItemSelect
          label={t("blood_type")}
          onChange={onChangeblood}
          value={formData.blood}
          options={BLOOD_TYPE_OPTIONS}
        />
      </div>
      <div className={styles.footer}>
        <div className={styles.btn_cancel} onClick={onClickCancel}>
          {t("cancel_btn")}
        </div>
        <div className={styles.btn_submit} onClick={onClickSubmit}>
          {t("submit_btn")}
        </div>
      </div>
    </div>
  );
}

export default MemberForm;
