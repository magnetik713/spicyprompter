document.addEventListener('DOMContentLoaded', function () {
  var fileInput = document.querySelector('input[name="workflow_json"]');
  if (!fileInput) return;

  // Built-in ComfyUI node types — not custom node deps
  var BUILTIN = new Set([
    'KSampler','KSamplerAdvanced','CheckpointLoaderSimple','CheckpointLoader',
    'CLIPTextEncode','CLIPSetLastLayer','VAEDecode','VAEEncode','VAELoader',
    'VAEEncodeForInpaint','LoadImage','LoadImageMask','SaveImage','PreviewImage',
    'ImageScale','ImageScaleBy','ImageUpscaleWithModel','UpscaleModelLoader',
    'LoraLoader','LoraLoaderModelOnly','EmptyLatentImage','LatentUpscale',
    'LatentUpscaleBy','LatentFromBatch','LatentComposite','LatentFlip','LatentRotate',
    'SetLatentNoiseMask','ConditioningCombine','ConditioningAverage',
    'ConditioningConcat','ConditioningSetArea','ConditioningSetMask',
    'ConditioningZeroOut','ControlNetLoader','ControlNetApply','ControlNetApplyAdvanced',
    'UNETLoader','DualCLIPLoader','CLIPLoader','TripleCLIPLoader',
    'ImagePadForOutpaint','InpaintModelConditioning','GLIGENLoader','GLIGENTextBoxApply',
    'HypernetworkLoader','ModelMergeSimple','ModelMergeBlocks','SaveCheckpoint',
    'CLIPMergeSimple','ModelSamplingDiscrete','ModelSamplingContinuousEDM',
    'RescaleCFG','PatchModelAddDownscale','LatentCrop','RepeatLatentBatch',
    'Primative','PrimitiveNode','Note','Reroute',
    'MaskToImage','ImageToMask','ImageColorToMask','SolidMask','InvertMask',
    'CropMask','FeatherMask','GrowMask','MaskComposite',
    'FlipSigmas','SamplerCustom','BasicScheduler','KarrasScheduler',
    'ExponentialScheduler','PolyexponentialScheduler','SDTurboScheduler',
    'SplitSigmas','SamplerDPMPP2M','SamplerDPMPP2MSDE','SamplerDPMAdaptative',
    'GuidanceLimiter','ModelSamplingFlux','FluxGuidance',
    'ImageCrop','ImageBatch','JoinImageWithAlpha','SplitImageWithAlpha'
  ]);

  // Prefix → package name mapping
  var PACKAGE_MAP = [
    [/^VHS_/,               'ComfyUI-VideoHelperSuite'],
    [/rgthree/i,            'rgthree-comfyui'],
    [/^DaSiWa_/,            'ComfyUI-DaSiWa'],
    [/^WAS_/,               'was-node-suite-comfyui'],
    [/^CR_|^Comfyroll/i,    'ComfyRoll-CustomNodes'],
    [/^ImpactPack|^SEG/,    'ComfyUI-Impact-Pack'],
    [/^ControlNet|^CN_/,    'comfyui_controlnet_aux'],
    [/^IPAdapter/,          'ComfyUI_IPAdapter_plus'],
    [/^FaceRestore|^GFPGAN/,'comfyui-facerestore'],
    [/^UltimateSD/,         'ComfyUI_UltimateSDUpscale'],
    [/^BNK_/,               'ComfyUI_Noise'],
    [/^Inspire/,            'ComfyUI-Inspire-Pack'],
    [/^SUPIR/,              'ComfyUI-SUPIR'],
    [/^easy|^EasyUse/i,     'ComfyUI-Easy-Use'],
    [/^ADE_/,               'ComfyUI-AnimateDiff-Evolved'],
    [/^FreeU/,              'ComfyUI-FreeU_Advanced'],
    [/^Anything|^AnythingEverwhere/i, 'cg-use-everywhere'],
    [/^DF_/,                'ComfyUI-Depth-Anything'],
    [/^FaceAnalysis/,       'ComfyUI-InsightFace'],
    [/^CLIPSeg/,            'clipseg'],
    [/^SeargeSDXL/,         'SeargeSDXL'],
    [/^Efficiency/,         'efficiency-nodes-comfyui'],
    [/^ttN_|^tinyterraNode/, 'tinyterraNodes'],
    [/^Power\s/i,           'rgthree-comfyui'],
    [/^Bookmark\s/i,        'rgthree-comfyui'],
    [/^Label\s/i,           'rgthree-comfyui'],
    [/^MarkdownNote/,       'Comfy-Ergonomics'],
    [/^PrimitiveStringMultiline/, 'Comfy-Ergonomics']
  ];

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  fileInput.addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        var ksampler = findKSampler(data);
        if (ksampler) {
          fillField('steps', ksampler.steps);
          fillField('cfg_scale', ksampler.cfg);
          fillField('denoise', ksampler.denoise);
          fillSelect('sampler', ksampler.sampler_name);
          fillSelect('scheduler', ksampler.scheduler);
        }
        var deps = extractDeps(data);
        if (deps.length) fillTextarea('dependencies', deps.join('\n'));
      } catch (err) {}
    };
    reader.readAsText(file);
  });

  function getNodeTypes(data) {
    if (data && data.nodes && Array.isArray(data.nodes)) {
      return data.nodes.map(function (n) { return n.type || ''; });
    }
    if (data && typeof data === 'object') {
      return Object.values(data).filter(function (v) { return v && v.class_type; }).map(function (v) { return v.class_type; });
    }
    return [];
  }

  function extractDeps(data) {
    var types = getNodeTypes(data);
    var found = {};
    types.forEach(function (t) {
      if (!t || BUILTIN.has(t)) return;
      var matched = false;
      for (var i = 0; i < PACKAGE_MAP.length; i++) {
        if (PACKAGE_MAP[i][0].test(t)) {
          found[PACKAGE_MAP[i][1]] = true;
          matched = true;
          break;
        }
      }
      if (!matched) {
        if (UUID_RE.test(t)) {
          found['unknown node: ' + t] = true;
        } else {
          found[t] = true;
        }
      }
    });
    return Object.keys(found).sort();
  }

  function findKSampler(data) {
    if (data && typeof data === 'object' && !data.nodes) {
      var keys = Object.keys(data);
      for (var i = 0; i < keys.length; i++) {
        var node = data[keys[i]];
        if (node && node.class_type === 'KSampler' && node.inputs) {
          return { steps: node.inputs.steps, cfg: node.inputs.cfg,
                   sampler_name: node.inputs.sampler_name,
                   scheduler: node.inputs.scheduler, denoise: node.inputs.denoise };
        }
      }
    }
    if (data && data.nodes && Array.isArray(data.nodes)) {
      var node = data.nodes.find(function (n) { return n.type === 'KSampler'; });
      if (node && node.widgets_values) {
        return { steps: node.widgets_values[2], cfg: node.widgets_values[3],
                 sampler_name: node.widgets_values[4], scheduler: node.widgets_values[5],
                 denoise: node.widgets_values[6] };
      }
    }
    return null;
  }

  function fillField(name, value) {
    if (value == null) return;
    var el = document.querySelector('input[name="' + name + '"]');
    if (el) el.value = value;
  }

  function fillSelect(name, value) {
    if (!value) return;
    var el = document.querySelector('select[name="' + name + '"]');
    if (!el) return;
    for (var i = 0; i < el.options.length; i++) {
      if (el.options[i].value.toLowerCase() === value.toLowerCase()) {
        el.value = el.options[i].value;
        return;
      }
    }
  }

  function fillTextarea(name, value) {
    var el = document.querySelector('textarea[name="' + name + '"]');
    if (el && !el.value) el.value = value;
  }
});
