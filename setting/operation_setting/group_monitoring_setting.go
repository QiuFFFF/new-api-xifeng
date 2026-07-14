package operation_setting

import (
	"github.com/QuantumNous/new-api/setting/config"
)

type GroupMonitoringSetting struct {
	Enabled                        bool     `json:"enabled"`
	MonitoringGroups               []string `json:"monitoring_groups"`
	AvailabilityPeriodMinutes      int      `json:"availability_period_minutes"`
	CacheHitPeriodMinutes          int      `json:"cache_hit_period_minutes"`
	AvailabilityExcludeModels      []string `json:"availability_exclude_models"`
	CacheHitExcludeModels          []string `json:"cache_hit_exclude_models"`
	AvailabilityExcludeKeywords    []string `json:"availability_exclude_keywords"`
	AvailabilityExcludeStatusCodes []int    `json:"availability_exclude_status_codes"`
	GroupDisplayOrder              []string `json:"group_display_order"`
	AggregationIntervalMinutes     int      `json:"aggregation_interval_minutes"`
	CacheTokensSeparateGroups      []string `json:"cache_tokens_separate_groups"`
	// 首字响应时间超过该秒数的请求不参与所有监控统计（可用率/缓存命中/响应时间/首字），0 表示不启用
	FRTExcludeThresholdSeconds float64 `json:"frt_exclude_threshold_seconds"`
}

var groupMonitoringSetting = GroupMonitoringSetting{
	Enabled:                        true,
	MonitoringGroups:               []string{},
	AvailabilityPeriodMinutes:      60,
	CacheHitPeriodMinutes:          60,
	AvailabilityExcludeModels:      []string{},
	CacheHitExcludeModels:          []string{},
	AvailabilityExcludeKeywords:    []string{},
	AvailabilityExcludeStatusCodes: []int{},
	GroupDisplayOrder:              []string{},
	AggregationIntervalMinutes:     5,
	CacheTokensSeparateGroups:      []string{},
	FRTExcludeThresholdSeconds:     0,
}

func init() {
	config.GlobalConfig.Register("group_monitoring_setting", &groupMonitoringSetting)
}

func GetGroupMonitoringSetting() GroupMonitoringSetting {
	return groupMonitoringSetting
}
