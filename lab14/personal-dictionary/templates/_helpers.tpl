{{- define "course-app.fullname" -}}
{{ .Release.Name }}-{{ .Chart.Name }}
{{- end }}

{{- define "course-app.redis.fullname" -}}
redis
{{- end }}