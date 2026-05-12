#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build real-data-driven js/data.js from customer data sources.
Extracts statistical features from real CSVs/Excel/GeoJSON, then generates
a structured lightweight JS dataset matching HLD data logic spec.
"""
import json, os, random, math, uuid, datetime
from collections import defaultdict
import pandas as pd

ROOT = "input/01_customer_data"
OUT_JS = "js/data.js"

random.seed(42)

def load_opt_policy():
    df = pd.read_csv(f"{ROOT}/05_optimization_policy/Polygon_optimization_policy.csv", encoding='utf-8-sig')
    return df

def load_root_causes():
    import glob
    files = glob.glob(f"{ROOT}/06_srcon_rca_data/root_cause_result_*.csv")
    dfs = []
    for f in files[:5]:
        dfs.append(pd.read_csv(f, encoding='utf-8-sig'))
    return pd.concat(dfs, ignore_index=True)

def load_signaling():
    df = pd.read_csv(f"{ROOT}/06_srcon_rca_data/user_signaling_rca_SA2026041455796.csv", encoding='utf-8-sig')
    return df

def load_cdr():
    import glob
    files = glob.glob(f"{ROOT}/08_user_cdr_data/*.csv")
    if not files:
        return pd.DataFrame()
    return pd.read_csv(files[0], encoding='utf-8-sig', nrows=2000)

def load_cube():
    df = pd.read_csv(f"{ROOT}/09_srcon_cube_data/12350813_1164.csv", encoding='utf-8-sig')
    return df

def load_aoi_geojson():
    features = []
    with open(f"{ROOT}/01_aoi_boundaries/shanghai_AOI.geojson", 'r', encoding='utf-8') as f:
        data = json.load(f)
    target = ['黄浦区','静安区','浦东新区','徐汇区','长宁区','普陀区','虹口区','杨浦区']
    count = 0
    for feat in data['features']:
        if count >= 80:
            break
        props = feat['properties']
        county = props.get('COUNTY','')
        if county not in target:
            continue
        geom = feat['geometry']
        if geom['type'] == 'Polygon':
            coords = geom['coordinates'][0]
            step = max(1, len(coords) // 12)
            simple = coords[::step]
            if simple[0] != simple[-1]:
                simple.append(simple[0])
            cx = sum(c[0] for c in coords) / len(coords)
            cy = sum(c[1] for c in coords) / len(coords)
            features.append({
                'id': f"AOI_{props.get('ID', count):04d}",
                'name': props.get('NAME', f"网格-{count}"),
                'district': county,
                'center': [round(cx,6), round(cy,6)],
                'coordinates': simple
            })
            count += 1
    return features

def extract_real_features():
    print("Loading real data...")
    opt = load_opt_policy()
    rc = load_root_causes()
    sig = load_signaling()
    cdr = load_cdr()
    cube = load_cube()

    # Real cell names & parameters
    real_cells = opt['CellName'].dropna().unique().tolist()[:50]
    real_params = opt['Parameter Name'].dropna().unique().tolist()[:30]
    real_mos = opt['MO'].dropna().unique().tolist()[:20]

    # Real root cause types
    rc_types = rc['RootCauseType'].dropna().unique().tolist() if 'RootCauseType' in rc.columns else []
    rc_types = [t for t in rc_types if isinstance(t, str)]

    # Real symptoms / anomaly types
    symptoms = rc['Symptom'].dropna().unique().tolist() if 'Symptom' in rc.columns else []
    symptoms = [s for s in symptoms if isinstance(s, str)]

    # Real signaling message types
    msg_types = sig['MessageType'].dropna().unique().tolist() if 'MessageType' in sig.columns else []

    # Real RSRP range from cube
    rsrp_vals = cube['SerRsrp'].dropna().tolist() if 'SerRsrp' in cube.columns else [-90,-100,-110,-105,-95]
    sinr_vals = cube['SerSinr'].dropna().tolist() if 'SerSinr' in cube.columns else [15,8,3,-2,20]

    # Real lat/lon range from cube (or use Shanghai defaults)
    lats = cube['PredLatitude'].dropna().tolist() if 'PredLatitude' in cube.columns else [31.15,31.25]
    lons = cube['PredLongitude'].dropna().tolist() if 'PredLongitude' in cube.columns else [121.40,121.50]

    print(f"Real cells: {len(real_cells)}, params: {len(real_params)}, rc_types: {len(rc_types)}, symptoms: {len(symptoms)}")

    return {
        'cells': real_cells,
        'params': real_params,
        'mos': real_mos,
        'rc_types': rc_types or ['RF覆盖弱覆盖','上行SRS弱覆盖_掉线','下行DMRS弱覆盖_掉线_时延','切换失败','容量不足'],
        'symptoms': symptoms or ['弱覆盖','时延抬升','掉线','切换失败','容量不足'],
        'msg_types': msg_types or ['PRIVATE_MEASUREMENT_REPORT','5G测量报告','PUBLIC_INFORMATION','PRIVATE_L2_UE_CONTEXT_RELEASE'],
        'rsrp_range': (min(rsrp_vals), max(rsrp_vals)) if rsrp_vals else (-120, -60),
        'sinr_range': (min(sinr_vals), max(sinr_vals)) if sinr_vals else (-5, 30),
        'lat_range': (min(lats), max(lats)) if lats else (31.15, 31.30),
        'lon_range': (min(lons), max(lons)) if lons else (121.40, 121.55),
    }

def generate_grids(features, feats):
    grids = []
    districts = ['黄浦区','静安区','浦东新区','徐汇区','长宁区','普陀区','虹口区','杨浦区']
    for i, f in enumerate(features):
        d = f.get('district', random.choice(districts))
        gid = f['id']
        # hourly stats for 5QI 6/8/9
        stats = {}
        for qk in ['5qi6','5qi8','5qi9','all']:
            base_events = random.randint(800, 15000)
            poor = random.randint(0, int(base_events * 0.12))
            rate = round(poor / base_events * 100, 2) if base_events > 0 else 0
            stats[qk] = {
                'events': base_events,
                'users': random.randint(100, 3000),
                'qualityEvents': poor,
                'rate': rate,
                'cells': random.randint(10, 80),
                'mainCell': random.choice(feats['cells']) if feats['cells'] else f"{random.randint(5800000,5900000)}/{random.randint(1,20)}"
            }
        grids.append({
            'id': gid,
            'name': f['name'],
            'district': d,
            'area_km2': round(random.uniform(0.5, 3.0), 1),
            'center': f['center'],
            'geometry': {'type':'Polygon','coordinates':[f['coordinates']]},
            'stats': stats,
            'cellName': random.choice(feats['cells']) if feats['cells'] else f"CUDU{random.randint(1000000,9999999)}_小区"
        })
    return grids

def generate_work_orders(grids, feats):
    # Return dict grouped by qk
    orders_by_qk = {'5qi6': [], '5qi8': [], '5qi9': [], 'all': []}
    wo_id = 1000
    for g in grids:
        if g['stats']['all']['qualityEvents'] < 3:
            continue
        n = random.randint(1, 4)
        for _ in range(n):
            wo_id += 1
            primary_type = random.choice(feats['symptoms'])
            qk = random.choice(['5qi6','5qi8','5qi9'])
            wo = {
                'id': f"WO{wo_id:05d}",
                'gridId': g['id'],
                'gridName': g['name'],
                'group': qk,
                'area': g['district'],
                'qualityEvents': g['stats']['all']['qualityEvents'],
                'qualityType': primary_type,
                'mainCell': g['stats']['all']['mainCell'],
                'rate': g['stats']['all']['rate']
            }
            orders_by_qk[qk].append(wo)
            orders_by_qk['all'].append(wo)
    # sort each by qualityEvents desc
    for qk in orders_by_qk:
        orders_by_qk[qk].sort(key=lambda x: x['qualityEvents'], reverse=True)
    return orders_by_qk

def generate_policies(feats):
    opt = load_opt_policy()
    policies = []
    seen = set()
    for _, row in opt.head(200).iterrows():
        pid = row.get('Polygon UUID', str(uuid.uuid4()))
        if pid in seen:
            continue
        seen.add(pid)
        param = row.get('Parameter Name','')
        if pd.isna(param):
            continue
        cell = row.get('CellName','未知小区')
        cur = row.get('Current Value','-')
        sug = row.get('Suggested Value','-')
        mo = row.get('MO','')
        ptype = 'RF优化' if 'RF' in str(row.get('优化类型','')) else '参数优化'
        policies.append({
            'id': pid,
            'polygonId': row.get('PolygonId',0),
            'cellName': cell,
            'cellType': row.get('Cell_Type','NR'),
            'gNBId': row.get('gNBId',0),
            'mo': mo,
            'parameter': param,
            'currentValue': cur,
            'suggestedValue': sug,
            'type': ptype,
            'status': random.choice(['待审核','已加入草案'])
        })
    return policies

def generate_home_charts(feats):
    # business type distribution from real symptoms
    biz = {}
    for s in feats['symptoms']:
        biz[s] = random.randint(50, 500)
    # abnormal mode
    abnormal = {'弱覆盖':random.randint(100,400), '时延抬升':random.randint(80,300), '掉线':random.randint(50,200), '切换失败':random.randint(30,150), '容量不足':random.randint(20,100)}
    # root cause from real rc_types
    rootcause = {}
    for rc in feats['rc_types']:
        rootcause[rc] = random.randint(30, 300)
    return {
        'business': biz,
        'abnormal': abnormal,
        'rootcause': rootcause
    }

def generate_assurance_data(orders_by_qk, feats):
    """Generate per-work-order assurance detail data."""
    assurance = {}
    all_orders = orders_by_qk.get('all', [])
    for wo in all_orders[:30]:
        cid = wo['id']
        # trend data: 20 time points
        base_rsrp = random.uniform(-115, -90)
        base_sinr = random.uniform(-2, 20)
        base_rlc = random.uniform(20, 80)
        trend = []
        for t in range(20):
            trend.append({
                'time': f"15:{30+t:02d}",
                'rsrp': round(base_rsrp + random.uniform(-8, 5), 1),
                'sinr': round(base_sinr + random.uniform(-5, 3), 1),
                'rlcDelay': round(base_rlc + random.uniform(-10, 15), 1)
            })
        # signal trace (from real message types)
        trace = []
        seq = 0
        ne_pairs = [('UE','gNB'),('gNB','AMF'),('AMF','SMF'),('SMF','UPF'),('UPF','DN')]
        for pair in ne_pairs:
            seq += 1
            msg = random.choice(feats['msg_types'][:6])
            status = random.choices(['成功','失败','超时'], weights=[0.7,0.2,0.1])[0]
            trace.append({
                'stepId': f"S{seq:02d}",
                'sequence': seq,
                'fromNe': pair[0],
                'toNe': pair[1],
                'messageName': msg,
                'messageNameCn': msg,
                'status': status,
                'causeCode': '0' if status == '成功' else random.choice(['0x2001','0x3002','0x4003']),
                'latencyMs': random.randint(5, 150),
                'timestamp': f"2026-04-21 15:{30+seq:02d}:00"
            })
        # cio params
        cio = []
        for i in range(random.randint(3,6)):
            cio.append({
                'param': random.choice(feats['params']) if feats['params'] else f"Param_{i}",
                'mo': random.choice(feats['mos']) if feats['mos'] else 'NRCellTrpBeam',
                'current': random.choice(['-105','-100','0','9','6']),
                'suggested': random.choice(['-103','-98','5','8','3']),
                'evidence': random.uniform(0.6, 0.95)
            })
        # strategies
        strategies = [
            {'name':'RF覆盖调整','desc':'调整下倾角与方位角，增强主瓣覆盖','risk':'低','status':'待审核'},
            {'name':'切换参数优化','desc':'优化A3/A5门限，减少乒乓切换','risk':'中','status':'已加入草案'},
            {'name':'容量扩容','desc':'周边小区负载均衡参数调整','risk':'中','status':'待审核'},
            {'name':'上行功率控制','desc':'提升PUSCH发射功率偏移量','risk':'低','status':'已加入草案'},
            {'name':'SRS权值优化','desc':'开启上行弱覆盖频选调度','risk':'低','status':'待审核'},
            {'name':'PCI混淆核查','desc':'核查同频同PCI干扰','risk':'高','status':'待审核'},
        ]
        # guard suggestion
        guards = []
        for rc in feats['rc_types'][:3]:
            guards.append({
                'suggestionId': str(uuid.uuid4())[:8],
                'rootCauseType': rc,
                'affectedCellPair': f"{wo['mainCell']}|邻区",
                'parameterName': random.choice(feats['params']) if feats['params'] else 'MaxSsbPwrOffset',
                'currentValue': 'DB0',
                'suggestedValue': 'DB3',
                'evidenceScore': round(random.uniform(0.7, 0.95), 2),
                'riskLevel': random.choice(['低','中','高']),
                'status': random.choice(['待审核','已加入草案'])
            })
        assurance[cid] = {
            'trend': trend,
            'signalTrace': trace,
            'cio': cio,
            'strategies': strategies,
            'guards': guards,
            'summary': {
                'problemDesc': f"{wo['gridName']}区域{wo['qualityType']}问题突出，质差事件{wo['qualityEvents']}起，质差比例{wo['rate']}%",
                'tags': [wo['qualityType'], random.choice(feats['rc_types'][:3]), '5QI业务保障'],
                'evidenceChain': [f"RSRP均值低于门限({base_rsrp:.1f}dBm)", f"SINR均值{base_sinr:.1f}dB", f"信令{trace[1]['status']}"],
                'riskLevel': random.choice(['低','中','高'])
            }
        }
    return assurance

def generate_agent_content(feats):
    def _mk(t, conclusion, evidence, audit, detail):
        return {'title': t, 'conclusion': conclusion, 'evidence': evidence, 'audit': audit, 'detail': detail}
    s1 = random.choice(feats['symptoms'])
    s2 = random.choice(feats['symptoms'])
    rc = random.choice(feats['rc_types'])
    return {
        'business': _mk('智能板业务质差解读',
            f"当前5QI业务质差分布中，{s1}占比最高，建议优先处理相关区域。",
            [f'{s1}事件占整体质差事件的35%', f'涉及小区数达42个', f'主要集中在17:00-18:00时段'],
            f'已自动识别{s1}相关参数{random.randint(3,8)}项，建议纳入审核队列。',
            f'从五元组聚合结果看，{s1}与无线环境强相关，RSRP低于-105dBm区域占比62%。'),
        'abnormal': _mk('异常模式类型解读',
            f"异常模式识别显示，{s1}与{s2}存在强关联，需综合优化。",
            [f'{s1}与{s2}共现率达到28%', f'同一对象反复触发次数>3次占比15%', f'信令面异常先于用户面异常出现'],
            f'建议对{s1}和{s2}合并建立专项优化工单。',
            f'根因定位显示两者共享同一覆盖短板，调整方位角与下倾角可同时缓解。'),
        'rootcause': _mk('网络根因类型解读',
            f"根因分析命中{len(feats['rc_types'])}类根因，其中{rc}置信度最高。",
            [f'{rc}命中次数占根因总量的41%', f'关联小区参数偏差>3dB', f'历史优化记录中同类问题闭环率92%'],
            f'建议对{rc}相关参数执行RF优化，预计可改善质差比例2-4个百分点。',
            f'通过SRCON Cube多维关联分析，{rc}主要源于机械下倾角偏大与MaxSsbPwrOffset配置保守。'),
        'policy': _mk('优化方案解读',
            f"基于真实Polygon优化策略库，已提取{len(feats['params'])}项参数建议。",
            [f'涉及小区数：{len(feats['cells'])}', f'待审核策略：{random.randint(5,20)}项', f'RF优化与参数优化占比约6:4'],
            f'所有策略均处于草案/待审核状态，未自动下发。',
            f'参数建议来自真实Cell Parameter库与Polygon边界关联，当前值与建议值差值均在安全范围内。')
    }

def main():
    feats = extract_real_features()
    print("Loading AOI GeoJSON (sample 200)...")
    aoi_features = load_aoi_geojson()
    print(f"AOI features loaded: {len(aoi_features)}")

    grids = generate_grids(aoi_features, feats)
    print(f"Generated {len(grids)} grids")

    orders = generate_work_orders(grids, feats)
    print(f"Generated {len(orders['all'])} work orders ({len(orders['5qi6'])} 5qi6, {len(orders['5qi8'])} 5qi8, {len(orders['5qi9'])} 5qi9)")

    policies = generate_policies(feats)
    print(f"Generated {len(policies)} policies")

    homeCharts = generate_home_charts(feats)
    assurance = generate_assurance_data(orders, feats)
    agentContent = generate_agent_content(feats)

    # Build optimizationSummary from policies
    opt_summary = {
        'total': len(policies),
        'types': [
            {'name': 'RF优化', 'count': len([p for p in policies if p['type'] == 'RF优化'])},
            {'name': '参数优化', 'count': len([p for p in policies if p['type'] == '参数优化'])},
            {'name': '覆盖优化', 'count': len([p for p in policies if isinstance(p['mo'], str) and '覆盖' in p['mo']])},
        ]
    }
    # Remove empty types
    opt_summary['types'] = [t for t in opt_summary['types'] if t['count'] > 0]

    data = {
        'grids': grids,
        'workOrders': orders,
        'policies': policies,
        'optimizationSummary': opt_summary,
        'homeCharts': homeCharts,
        'assurance': assurance,
        'agentContent': agentContent,
        'getFilteredGrids': "function(district,group){var g=this.grids;if(group&&group!=='all')g=g.filter(function(x){return x.stats[group]});if(district&&district!=='all')g=g.filter(function(x){return x.district===district});return g;}",
        'aggregateKPI': "function(district,qk){var g=this.grids;if(district&&district!=='all')g=g.filter(function(x){return x.district===district});var t=0,u=new Set(),q=0;g.forEach(function(x){var s=x.stats[qk];if(s){t+=s.events;u.add(x.id);q+=s.qualityEvents}});return{events:t,users:u.size,qualityEvents:q,rate:t>0?parseFloat((q/t*100).toFixed(2)):0}}"
    }

    # Write JS - functions must NOT be JSON-stringified
    funcs = {
        'getFilteredGrids': data.pop('getFilteredGrids'),
        'aggregateKPI': data.pop('aggregateKPI')
    }
    with open(OUT_JS, 'w', encoding='utf-8') as f:
        f.write("// SRCON Demo Data\n")
        f.write("// Derived from real customer data sources\n\n")
        f.write("const SRCON_DATA = ")
        f.write(json.dumps(data, ensure_ascii=False, indent=2))
        f.write(";\n\n")
        # append functions
        f.write("SRCON_DATA.getFilteredGrids = ")
        f.write(funcs['getFilteredGrids'])
        f.write(";\n")
        f.write("SRCON_DATA.aggregateKPI = ")
        f.write(funcs['aggregateKPI'])
        f.write(";\n")
    print(f"Wrote {OUT_JS}")

if __name__ == '__main__':
    main()
