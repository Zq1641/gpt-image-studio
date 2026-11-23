export type TemplateId = 'ecommerce' | 'photography' | 'poster' | 'creative' | 'art'

export interface Template {
  id: TemplateId
  label: string
  en: string           // 英文小副标
  index: string        // 编号 #01
  text: string
}

// ---------------------------------------------------------------------------
// 提示词框架说明（针对 gpt-image-2 / 2.5 适配）
// 结构统一为：主体 Subject + 风格 Style（单风格） + 构图 Composition +
// 灯光 Lighting（技术术语） + 细节锚点 Detail anchors + 约束 Constraints。
//  - 单主体：一次只讲一个主角，多主角会被模型自动取舍。
//  - 单风格：photorealistic / flat vector / oil painting 三选一，不混搭。
//  - 技术词代替虚词：用 85mm / f/1.8 / softbox / Rembrandt 代替“好看、高清、惊艳”。
//  - 图中文字必须用引号逐字指定：“标题”，不错不增不减（2/2.5 的强项）。
//  - 画面比例由左侧 Format 面板控制，模板正文不再写死比例，避免与 size 参数打架。
// ---------------------------------------------------------------------------

export const TEMPLATES: Template[] = [
  {
    id: 'ecommerce',
    label: '电商',
    en: 'E-commerce',
    index: '01',
    text: '商业产品摄影，主体为 [产品名称+颜色+材质，如：哑光白陶瓷香薰杯]，居中放于 [浅灰无缝纸背景 + 白色倒影台面] 上，比例真实无变形。灯光：大型柔光箱主光（左前45°）+ 右侧轮廓光 + 顶部漫反射补光，阴影柔和干净。机位平视微俯，50mm标准镜头，f/8全清晰对焦，产品边缘锐利。上方留白约1/3，便于后期加文案。风格 photorealistic, studio lighting, hyper-detailed。约束：画面干净无杂物，不添加多余道具，不虚构品牌文字与Logo，材质质感真实。',
  },
  {
    id: 'photography',
    label: '摄影',
    en: 'Photography',
    index: '02',
    text: '纪实[人像/风光/街头]摄影，主体 [年龄性别服装人物，如：30岁男咖啡师穿黑色围裙] 位于 [具体场景，如：清晨的市场摊位前]，正在 [动作，如：低头拉花]。自然光为主，[黄金时刻侧光 / 阴天柔光]，肤色真实自然。机位[平视/低角度]，85mm人像镜头，f/1.8浅景深，背景柔和虚化但可辨环境。色调 muted teal-and-amber电影级调色，轻微35mm胶片颗粒。风格 photorealistic, candid moment。约束：单主体，五官自然无畸变，手部结构正确，光影方向一致。',
  },
  {
    id: 'poster',
    label: '海报',
    en: 'Poster Design',
    index: '03',
    text: '现代主义海报设计，主题 [影片/活动名]，主视觉为 [人物剪影/核心图形，具体描述] 居中构图，背景 [深色底 + 单强调色，如：米白底 + 朱红点缀]。版式：标题“[主标题，8字以内]”居中置顶，粗黑无衬线大字，字距紧凑；副文案“[副标题/日期，15字以内]”置底小字号；四周留白均衡。风格 flat vector, minimalist layout, high contrast。约束：严格按引号内文字逐字渲染，不错不增不减、无乱码；单风格不混用3D与扁平；配色不超过3种。',
  },
  {
    id: 'creative',
    label: '创意',
    en: 'Creative Art',
    index: '04',
    text: '超现实概念艺术，单一主角 [奇幻生物/异构建筑，具体描述] 悬浮于 [梦境空间，如：倒置的沙漠湖面] 之上，[钴蓝+暖橙互补色]主导，[融化/漂浮/折叠三选一]手法贯穿画面。氛围：体积雾 + 逆光轮廓光，尺度对比强烈（巨大主体 vs 微小人物剪影）。风格 single surreal digital painting, dreamlike atmosphere, intricate details。约束：单主体单风格，不堆砌多主角；写实与卡通二选一不混搭；无文字，除非引号逐字指定。',
  },
  {
    id: 'art',
    label: '艺术',
    en: 'Fine Art',
    index: '05',
    text: '博物馆级美术创作，媒介单选 [古典油画 / 水彩 / 水墨 其一]，描绘 [古典人物 / 自然风景，具体内容]。笔触 [厚涂肌理 / 细腻晕染]，[莫兰迪灰调 / 暖赭石]配色体系，伦勃朗式布光，明暗过渡柔和。构图[三分法 / 中心对称]，画布纹理可见，主体完整不裁切。风格 fine art, masterful brushwork, archival quality。约束：单媒介不混搭，人物结构准确，色彩克制不超过5种，无照片感、无CG感、无文字水印。',
  },
]
