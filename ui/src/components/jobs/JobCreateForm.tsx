import { Flag } from "@hooks/useJobsData";
import { TargetFlag, useTargets } from "@hooks/useTargets";
import {
  InboxOutlined,
  MinusCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  Button,
  Divider,
  Form,
  FormListFieldData,
  Row,
  Select,
  Space,
  Upload,
} from "antd";
import { FormInstance, useForm } from "antd/es/form/Form";
import { useEffect, useMemo, useState } from "react";
import { DefaultOptionType } from "antd/es/select";
import { MessageInstance } from "antd/es/message/interface";

function mapToSelect(values: string[]) {
  return values.map((value) => ({ value, label: value }));
}

interface FormTagProps {
  flags: Record<string, TargetFlag>;
  form: FormInstance<JobCreationParams>;
  value: FormListFieldData;
  index: number;
  remove: (index: number | number[]) => void;
}

function FormTag({ flags, form, value, index, remove }: FormTagProps) {
  const [currentFlag, setCurrentFlag] = useState("");
  const [currentValue, setCurrentValue] = useState("");

  // selected flags
  const selectedFlags = useMemo(
    () => form.getFieldsValue()?.flags ?? [],
    [form]
  );

  // current flag not in flag list, then remove it
  useEffect(() => {
    if (currentFlag == "" || Object.hasOwn(flags, currentFlag)) return;
    remove(index);
  }, [currentFlag, flags, form, selectedFlags, index, remove]);

  // flag values
  const values = [...new Set(flags[currentFlag]?.values)];
  values.sort();

  // current value not in flag value? reset it
  if (currentValue && !values.includes(currentValue)) {
    selectedFlags[index].value = "";
  }

  // selected flags
  const selectedFlagsName = new Set(
    selectedFlags
      .filter((flag: { name?: string }) => flag?.name)
      .map((flag: { name: string }) => flag.name)
  );

  // remove already selected flags from options
  const flagKeys = Object.keys(flags);
  flagKeys.sort();
  const flagOptions = mapToSelect(flagKeys).filter(
    (option) => !selectedFlagsName.has(option.label)
  );
  const valueOptions = mapToSelect(values);

  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <Space.Compact block style={{ display: "flex" }}>
        <Form.Item
          style={{ flex: 1 }}
          name={[value.name, "name"]}
          rules={[
            {
              required: true,
              message: "Missing flag",
            },
          ]}
        >
          <Select
            showSearch
            placeholder="Flag"
            onChange={(flag) => setCurrentFlag(flag)}
            options={flagOptions}
          />
        </Form.Item>

        <Form.Item
          style={{ flex: 1 }}
          name={[value.name, "value"]}
          rules={[{ required: true, message: "Missing value" }]}
        >
          <Select
            showSearch
            placeholder="Value"
            onChange={(value) => setCurrentValue(value)}
            options={valueOptions}
          />
        </Form.Item>
      </Space.Compact>
      <MinusCircleOutlined
        onClick={() => remove(value.name)}
        style={{ fontSize: "1.15rem", transform: "translate(0, 4px)" }}
      />
    </div>
  );
}

interface JobCreationParams {
  release: string;
  target: string;
  flags: Flag[];
}

interface Props {
  messageApi: MessageInstance;
  onFinish: (
    values: JobCreationParams,
    jobsFileContent: object | undefined
  ) => void;
}

function JobCreateForm({ messageApi, onFinish }: Props) {
  const [form] = useForm<JobCreationParams>();

  // target and release options for form select input
  const { targets } = useTargets();
  const [releaseOptions, setReleaseOptions] = useState<DefaultOptionType[]>([]);
  const [targetOptions, setTargetOptions] = useState<DefaultOptionType[]>([]);
  const [currentTarget, setCurrentTarget] = useState("");
  const [currentRelease, setCurrentRelease] = useState("");

  // set release to first release of cloudbuild targets
  useEffect(() => {
    if (!targets) return;
    const releasesKeys = Object.keys(targets.releases);
    releasesKeys.sort((a, b) => {
      if (b == "nightly") return 1;
      return (b > a) ? 0 : -1;
    });

    setReleaseOptions(mapToSelect(releasesKeys));
    form.setFieldValue("release", releasesKeys[0]);
    setCurrentRelease(releasesKeys[0]);
  }, [targets, form]);

  // set target to first target of cloudbuild targets
  useEffect(() => {
    if (!targets) return;
    let releaseTargets = Object.keys(targets.targets);
    const excludeTargets = targets.releases[currentRelease]?.exclude_targets;

    if (excludeTargets) {
      releaseTargets = releaseTargets.filter(
        (target) => !excludeTargets.includes(target)
      );
    }

    setTargetOptions(mapToSelect(releaseTargets));
    form.setFieldValue("target", releaseTargets[0]);
    setCurrentTarget(releaseTargets[0]);
  }, [targets, currentRelease, form]);

  // flags
  const flags = structuredClone(targets?.flags) ?? {};

  // get additional flags from the target tags
  const tags = targets?.targets[currentTarget]?.tags;
  const additionalFlags: Record<string, TargetFlag> =
    tags?.reduce((obj, tag) => {
      obj = { ...targets?.tags[tag].flags, ...obj };
      return obj;
    }, {}) ?? {};

  // add new flags defined in the tags in the flags list
  for (const [key, value] of Object.entries(additionalFlags)) {
    if (!Object.hasOwn(flags, key)) {
      flags[key] = value;
    }
  }

  // file list and file content for upload file form input
  const [fileList, setFileList] = useState<File[]>([]);
  const [jobsFileContent, setJobsFileContent] = useState<object | undefined>();

  const onFileBeforeUpload = async (file: File) => {
    if (file.type === "application/json") {
      try {
        const jsonContent = JSON.parse(await file.text());
        setJobsFileContent(jsonContent);
        setFileList([file]);
      } catch (error) {
        messageApi.error("Could not parse JSON file!");
      }
    } else {
      messageApi.error("You can only upload JSON file!");
    }
    return false;
  };

  const onFileRemove = () => {
    setJobsFileContent(undefined);
    setFileList([]);
  };

  return (
    <>
      <Form
        labelCol={{ span: 4 }}
        aria-labelledby=""
        form={form}
        name="Job Creation"
        onFinish={(values) => {
          onFinish(values, jobsFileContent);
        }}
        style={{ marginTop: "2rem" }}
      >
        <Form.Item
          label="Release"
          name="release"
          rules={[{ required: jobsFileContent == undefined }]}
        >
          <Select
            options={releaseOptions}
            onChange={(newRelease) => setCurrentRelease(newRelease)}
          />
        </Form.Item>

        <Form.Item
          label="Target"
          name="target"
          rules={[{ required: jobsFileContent == undefined }]}
        >
          <Select
            showSearch
            options={targetOptions}
            onChange={(newTarget) => setCurrentTarget(newTarget)}
          />
        </Form.Item>

        <Form.List name="flags" initialValue={[]}>
          {(fields, { add, remove }) => (
            <Form.Item label="Flags">
              {fields.map((value, index) => (
                <div key={value.key}>
                  <FormTag
                    {...{
                      flags,
                      form,
                      value,
                      index,
                      remove,
                    }}
                  />
                </div>
              ))}

              <Form.Item>
                <Button
                  type="dashed"
                  onClick={() => add()}
                  block
                  icon={<PlusOutlined />}
                >
                  Add Flag
                </Button>
              </Form.Item>
            </Form.Item>
          )}
        </Form.List>

        <Divider />

        <Form.Item
          labelCol={{ span: 24 }}
          style={{ flexDirection: "column" }}
          label="Upload multiple jobs"
        >
          <Upload.Dragger
            name="file"
            maxCount={1}
            fileList={fileList as any}
            onRemove={onFileRemove}
            beforeUpload={onFileBeforeUpload}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              Click or drag file to this area to upload
            </p>
          </Upload.Dragger>
        </Form.Item>

        <Row justify={"center"}>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Submit
            </Button>
          </Form.Item>
        </Row>
      </Form>
    </>
  );
}

export default JobCreateForm;
