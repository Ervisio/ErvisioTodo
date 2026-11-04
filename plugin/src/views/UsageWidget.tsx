/** Dashboard widget: open tasks and users. It never asks for administrator rights and fails quietly. */
import { getSdk } from "../sdk";
import * as todo from "../api/todo";
import { Button } from "../kit";
import { hostOf, num, t, useLoad } from "./util";

export function UsageWidget() {
  const st = useLoad(todo.statusQuiet);
  const open = () => getSdk().open("todo");

  if (!st.data) {
    if (st.loading) return <p className="td-w-muted">{t("w.loading")}</p>;
    return <p className="td-w-muted">{t("w.unavailable")}</p>;
  }
  const { counts, publicUrl } = st.data;
  return (
    <div className="td-w">
      <div className="td-w-st">
        <i />
        <b>{t("ov.active")}</b>
      </div>
      <div className="td-w-big">
        <b>{t("w.openTasks", { n: num(counts.openTasks) })}</b>
        <span>
          {t("w.people", {
            users: num(counts.users),
            lists: num(counts.lists),
          })}
        </span>
        <span>{hostOf(publicUrl || null) ?? t("ov.noUrl")}</span>
      </div>
      <Button size="sm" onClick={open}>
        {t("w.open")}
      </Button>
    </div>
  );
}
