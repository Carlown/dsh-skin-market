import { satisfiesVersionRange } from './semver.ts'
import type { CompatibilityAdapter, DshRuntime, SkinEntry } from './types.ts'

type CompatibilitySkin = Pick<SkinEntry, 'compatibility'>

const KEYED_SLOT_CAPABILITY_PREFIX = 'slot:keyed:'

export interface CompatibilityAssessment {
  decision: 'compatible' | 'adaptable' | 'unknown' | 'incompatible'
  reason: string
  adapterIds: string[]
}

const DEFAULT_ADAPTER: CompatibilityAdapter = {
  id: 'builtin-keyed-settings-plugin-item',
  kind: 'keyed-slot-id-to-key',
  when: '>=0.1.0-rc.6 <0.2.0-0',
  slot: 'settings.plugin.item',
  key: 'locale',
}
const BUILTIN_ADAPTER_BASE_VERSION = '0.1.0-rc.6'

function declaredAdapters(skin: CompatibilitySkin): CompatibilityAdapter[] {
  return skin.compatibility.adapters ?? []
}

function sameAdapter(left: CompatibilityAdapter, right: CompatibilityAdapter): boolean {
  return left.kind === right.kind
    && left.when === right.when
    && left.slot === right.slot
    && left.key === right.key
}

export function applicableAdapters(skin: CompatibilitySkin, runtime: DshRuntime, includeBuiltIns: boolean): CompatibilityAdapter[] {
  if (runtime.version === null) return []
  const declared = declaredAdapters(skin)
  const adapters = includeBuiltIns && skin.compatibility.dsh !== 'unverified' && satisfiesVersionRange(BUILTIN_ADAPTER_BASE_VERSION, skin.compatibility.dsh)
    ? [...declared, DEFAULT_ADAPTER]
    : declared
  const uniqueAdapters = adapters.filter((adapter, index, all) => all.findIndex(item => sameAdapter(item, adapter)) === index)
  return uniqueAdapters.filter(adapter =>
    satisfiesVersionRange(runtime.version!, adapter.when)
    && runtime.capabilities.includes(`${KEYED_SLOT_CAPABILITY_PREFIX}${adapter.slot}`),
  )
}

export function assessCompatibility(skin: CompatibilitySkin, runtime: DshRuntime): CompatibilityAssessment {
  if (runtime.version === null) return {
    decision: 'unknown',
    reason: '无法读取当前 DSH 版本，暂时拦截安装以避免破坏 profile',
    adapterIds: [],
  }

  const declared = applicableAdapters(skin, runtime, false)
  if (skin.compatibility.dsh === 'unverified') return {
    decision: 'unknown',
    reason: `皮肤未声明 DSH 兼容范围（当前 ${runtime.version}）`,
    adapterIds: declared.map(adapter => adapter.id),
  }
  if (declared.length > 0) return {
    decision: 'adaptable',
    reason: `当前 DSH ${runtime.version} 命中可选兼容适配器`,
    adapterIds: declared.map(adapter => adapter.id),
  }
  if (satisfiesVersionRange(runtime.version, skin.compatibility.dsh)) return {
    decision: 'compatible',
    reason: `当前 DSH ${runtime.version} 在声明范围 ${skin.compatibility.dsh} 内`,
    adapterIds: [],
  }

  // Built-in adapters are generic migrations. Their applicability is known
  // from the runtime capability; the installed package is still inspected
  // before a patch is actually persisted.
  const builtIns = applicableAdapters(skin, runtime, true)
  if (builtIns.length > 0) return {
    decision: 'adaptable',
    reason: `当前 DSH ${runtime.version} 可通过通用兼容适配器安装`,
    adapterIds: builtIns.map(adapter => adapter.id),
  }
  return {
    decision: 'incompatible',
    reason: `当前 DSH ${runtime.version} 不在皮肤声明的兼容范围 ${skin.compatibility.dsh} 内，且没有可用适配器`,
    adapterIds: [],
  }
}
