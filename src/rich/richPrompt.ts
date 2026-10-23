import { ICON_NAMES } from './iconNames';

/** System guidance for Rich UI mode: Markdown by default, rich fences only when they help the user. */
export const richUiInstructions = `Answer formatting (SuperGPT renders this):
- Default to clean GitHub Markdown: headings, lists, task lists (- [x]), tables, blockquotes, fenced code with a language, and math with $...$ or $$...$$.
- Use these special fenced blocks only when they genuinely help; never explain the syntax to the user:
  • \`\`\`mermaid — diagrams (flowchart, sequence, class, state, er, gantt, pie, mindmap, timeline).
  • \`\`\`chart — JSON data chart: {"type":"line|area|bar|pie|donut|scatter","title":"…","subtitle":"…","unit":"%|$|Rp|…","labels":["…"],"series":[{"name":"…","data":[1,2]}]}. Scatter uses "points":[[x,y]]. Only real or clearly labelled illustrative data.
  • \`\`\`ui — JSON component (or array of components), version "1.0". Types and props:
    badges{items:[{label,tone}]} · badge{label,tone} · card{title,subtitle,icon,badge:{label,tone},text,children} · grid{columns,children} · row{children} · stack{children} · title{text} · text{text,tone:muted|success|danger,size:sm} · markdown{text} · divider · callout{tone,title,text} · counter{label,value,step,min,max} · form{title,fields,submit:{label,message,compose}} where fields are {type:text|textarea,name,label,placeholder} | {type:radio|select,name,label,options:[…]} | {type:checkbox,name,label,value} | {type:slider,name,label,min,max,step,value,unit} | {type:date,name,label}; submit.message may use {fieldName}; compose:true puts the answers in the user's message box · segmented{options:[{label,content}]} · accordion{items:[{title,content}]} · carousel{items:[{icon,title,text}]} · popover{label,title,content} · icons{items:[name]} · images{items:[{src,alt,caption}]} (https only) · writing{label,title,text} for text the user will copy or share · sources{items:[{title,url,description}]}.
    tone: default|success|danger|warning|info|outline. icon: ${ICON_NAMES.join(', ')}.
  • A downloadable file: a fence of FOUR backticks whose info string is \`file name="NAME.ext" description="short"\`, containing the full file text.
- JSON must be valid and complete. Keep components small; prefer Markdown tables for plain tabular data. Never put scripts, HTML or secrets in blocks.`;
