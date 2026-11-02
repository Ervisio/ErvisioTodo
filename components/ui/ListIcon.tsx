"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { far } from "@fortawesome/free-regular-svg-icons";
import { fab } from "@fortawesome/free-brands-svg-icons";
export function ListIcon({
  list,
}: {
  list: { iconType: string; iconValue: string };
}) {
  if (list.iconType === "image")
    return (
      <img
        src={list.iconValue}
        alt=""
        className="h-6 w-6 rounded object-cover"
      />
    );
  if (list.iconType === "fontawesome") {
    const [prefix, name] = list.iconValue.split(" "),
      pack = prefix === "fa-brands" ? fab : prefix === "fa-regular" ? far : fas;
    const icon = Object.values(pack).find(
      (i) => i.iconName === name?.replace(/^fa-/, ""),
    );
    return icon ? (
      <FontAwesomeIcon icon={icon} className="h-5 w-5" />
    ) : (
      <FontAwesomeIcon icon={fas.faListCheck} className="h-5 w-5" />
    );
  }
  return <span aria-hidden="true">{list.iconValue}</span>;
}
